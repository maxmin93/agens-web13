import { Component, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';

// materials
import { MatDialog, MatSnackBar, MatButtonToggle, MatInput } from '@angular/material';

import { DatatableComponent } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';
import { Angulartics2 } from 'angulartics2';

import * as _ from 'lodash';
import { Observable, Subscription } from 'rxjs';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import * as CONFIG from '../../global.config';

import { IResultDto } from '../../models/agens-response-types';
import { IGraph, ILabel, INode, IEdge, IRecord, IColumn } from '../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import { IProject } from '../../models/agens-manager-types';

// Dialogs
import { SearchResultDialog } from './dialogs/search-result.dialog';
import { ProjectOpenDialog } from './dialogs/project-open-dialog';
import { ProjectSaveDialog } from './dialogs/project-save-dialog';
import { LabelStyleSettingDialog } from './dialogs/label-style-setting.dialog';
import { ImageExportDialog } from './dialogs/image-export.dialog';

declare var $: any;
declare var CodeMirror: any;
declare var agens: any;

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements AfterViewInit, OnInit, OnDestroy {

  private subscription : Subscription;
  public project : any = null;

  // cytoscape 객체
  private cy: any = null;

  // executing time display : setInterval(), clearInterval()
  elapsedTimeHandler = null;
  
  // CodeMirror Handler
  editor: any;
  editorRef: any;
  // CodeMirror Editor : initial value
  query:string =
`
 `;
  // result message output
  resultMessage = { fontColor: 'darkgray', text: '...' };

  // core/query API 결과
  private resultDto: IResultDto = null;
  private resultStats: any = { nodeLabelSize: 0, edgeLabelSize: 0 };

  // expandTo 를 위한 query API 결과
  private resultExpandTo: IResultDto = null;

  graphLabels: any[] = [];
  recordColumns: Array<IColumn> = new Array();
  recordRows: Array<any> = new Array<any>();
  recordRowsCount: number = 0;
  isJsonCell: boolean = false;

  selectedCell: any = {};
  selectedRowIndex: number = -1;
  selectedColIndex: number = -1;

  selectedElement: any = null;
  // neighbors 선택시 select 추가를 위한 interval 목적
  timeoutNodeEvent: any = null;

  initWindowHeight:number;
  // pallets : Node 와 Edge 라벨별 color 셋
  labelColors: any[] = [];

  currProject: IProject = null;

  // ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
  @ViewChild('recordTable') recordTable: DatatableComponent;

  // material elements
  @ViewChild('btnMouseWheelZoom') public btnMouseWheelZoom: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
  @ViewChild('tableCell') public tableCell: ElementRef;

  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('queryEditor', {read: ElementRef}) queryEditor: ElementRef;
  @ViewChild('queryMessage', {read: ElementRef}) queryMessage: ElementRef;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(    
    private _angulartics2: Angulartics2,    
    private _ngZone: NgZone,    
    public dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { }

  ngOnInit(){
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () => this.cyCanvasCallback(),
      cyElemCallback: (target) => this.cyElemCallback(target),
      cyNodeCallback: (target) => this.cyNodeCallback(target),
      cyQtipMenuCallback: (target, value) => this.cyQtipMenuCallback(target, value),
      component: this
    };
  }

  ngOnDestroy(){
    if( this.subscription ) this.subscription.unsubscribe();
    // 내부-외부 함수 공유 해제
    window['angularComponentRef'] = null;
  }

  ngAfterViewInit() {
    this._api.changeMenu('graph');

    // Cytoscape 생성
    if( this.cy === null ) {
      this.cy = agens.graph.graphFactory(
        this.divCanvas.nativeElement, {
          selectionType: 'additive',    // 'single' or 'additive'
          boxSelectionEnabled: true, // if single then false, else true
          useCxtmenu: true,          // whether to use Context menu or not
          hideNodeTitle: true,       // hide nodes' title
          hideEdgeTitle: true,       // hide edges' title
        });
    } 

    // CodeMirror : get mime type
    var mime = 'application/x-cypher-query';
    this.editor = CodeMirror.fromTextArea( this.queryEditor.nativeElement, {
      mode: mime,
      indentWithTabs: true,
      smartIndent: true,
      lineNumbers: true,
      matchBrackets : true,
      autofocus: true,
      theme: 'eclipse'
    });
    // CodeMirror : initial value
    this.editor.setValue( this.query );

    //
    // ** NOTE: 이거 안하면 이 아래쪽에 Canvas 영역에서 마우스 포커스 miss-position 문제 발생!!
    //
    // keyup event
    this.editor.on('keyup', function(cm, e){      
      // console.log('this.editor is keyup:', e.keyCode );
      if( e.keyCode == 13 ) agens.cy.resize();
    });

    // pallets 생성 : luminosity='dark'
    this.labelColors = this._util.randomColorGenerator('dark', CONFIG.MAX_COLOR_SIZE);

  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = null;
  }

  // graph elements 중 node 클릭 콜백 함수
  cyNodeCallback(target:any):void {
    // graph의 HighlightNeighbors 버튼 On 상태라면
    if( this.btnHighlightNeighbors.checked ){
      // 정보창 출력하지 않기
      this.selectedElement = null;
      if( agens.cy.viewUtil._findNeighborsWithoutDuplicatedLabel !== undefined ){
        //
        // **NOTE: 시간차(100ms)가 중요하다!! 그렇지 않으면
        //         clickEvenet 에서 cyTarget은 다시 선택되지 않음 (autoselect 탓)
        //
        clearTimeout(this.timeoutNodeEvent);
        this.timeoutNodeEvent = setTimeout(function(){
          //
          // **NOTE: 추가적인 select를 위해 unselect를 하지 않음

          // show graph ProgressBar
          let graphProgressBar:any = document.querySelector('div#graphProgressBar');
          graphProgressBar.style.visibility = 'visible';   //hidden

          // neighbors select
          var neighbors = agens.cy.viewUtil._findNeighborsWithoutDuplicatedLabel(target, [], 3, function(){
            // show graphProgressBar
            let graphProgressBar:any = document.querySelector('div#graphProgressBar');
            graphProgressBar.style.visibility = 'hidden';   // visible
          });

          neighbors = neighbors.add( target );
          neighbors.select().addClass('highlighted');

          // selected 된 모든 nodes 간의 edges도 선택
          var selectedNodes = agens.cy.elements('node:selected');
          selectedNodes.connectedEdges().filter( (i,elem) => {
            // collection.contains() 함수가 없음 (2.x버전에는)
            var sourceNode = neighbors.getElementById(elem.source().id());
            var targetNode = neighbors.getElementById(elem.target().id());
            // 없는 경우 null 이 아닌 empty collection 을 반환 (size 확인해야함)
            return sourceNode.size() > 0 && targetNode.size() > 0;
          }).select().addClass('highlighted');

        }, 100); // may have to adjust this val

        this._angulartics2.eventTrack.next({ action: 'findNeighbors', properties: { category: 'graph', label: target.group()+'_'+target.id() }});
      }
    }    
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;

    // HighlightNeighbors 상태가 아닌 일반 상태라면 unselect
    if( !this.btnHighlightNeighbors.checked ){
      agens.cy.elements(':selected').unselect();
    }
  }  

  cyQtipMenuCallback( target:any, targetName:string ){
    //
    // **NOTE: 확장 쿼리 (source 라벨은 필요 없음)
    // expandTo SQL:
    // ex) match (s:"customer")-[e]-(v:"order") where id(s) = '11.1' return e, v limit 5;
    //

    let expandId = target.data('labels')[0]+'_'+target.data('id');
    target.data('$$expandid', expandId);
    let position = target.position();
    let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };

    //
    // **NOTE: 확장 노드 사이즈 = 20
    //         20개만 확장 (너무 많아도 곤란) <== 단지 어떤 데이터가 더 있는지 보고 싶은 용도임!
    //
    let sql = `match (s:"${target.data('labels')[0]}")-[e]-(v:"${targetName}") where to_jsonb(id(s)) = '${target.data('id')}' return e, v limit 20;`;
    if( this._api.getClient().product_version <= '1.2' ){
      sql = `match (s:"${target.data('labels')[0]}")-[e]-(v:"${targetName}") where id(s) = '${target.data('id')}' return e, v limit 20;`;
    }

    // console.log( 'cyQtipMenuCallback: '+expandId+' ==> '+sql );
    // this.runExpandTo( sql, expandId, boundingBox );

    // this._angulartics2.eventTrack.next({ action: 'expandTo', properties: { category: 'graph', label: `${target.data('labels')[0]}-->${targetName}` }});
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // when button "NEW" click
  clearProject(){
    // 결과값 지우고
    this.resultDto = null;
    this.resultStats = { nodeLabelSize: 0, edgeLabelSize: 0 };

    // 에디터 비우고
    this.editor.setValue('');
    // 메시지창 비우고
    this.resultMessage = { fontColor: 'darkgray', text: '...' };
    // 결과들 비우고
    this.clearResults();

    // 프로젝트 정보 지우고
    this.currProject = null;
  }

  // 결과들만 삭제 : runQuery 할 때 사용
  clearResults(){
    this.elapsedTimeHandler = null;
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    this.graphLabels = [];
    // 그래프 관련 콘트롤러들 초기화
    this.toggleMouseWheelZoom(false);
    this.toggleHighlightNeighbors(false);
    this.selectedElement = null;
    // 테이블 비우고
    this.recordRowsCount = 0;
    this.recordRows = [];
    this.recordColumns = [];
    // 클릭된 셀 Json 출력도 비우고
    this.tableCell.nativeElement.style.visibility = 'hidden';   // this.isJsonCell = false;
    this.selectedCell = {};
    this.selectedRowIndex = -1;
    this.selectedColIndex = -1;
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  makeupSql(sql:string):string {
    let newLines:string[] = [];
    sql = sql.replace(/\r?\n/g, '||');
    let lines:string[] = sql.split('||');
    lines.forEach((val)=>{
      val = val.trim();
      if( !val.startsWith('--') ){
        if( val.indexOf('--')>=0 ) newLines.push( val.substring(0, val.indexOf('--')) );
        else newLines.push( val );
      }
    });
    return newLines.join(' ');
  }

  displayRunningTime(){

    // **NOTE: In setInterval, text.value update by querySelector
    // setInterval() 안에서는 component 멤버 변수에 대한 업데이트 가 안된다.
    // querySelector로 DOM에 직접 값을 써야 변경됨
    // let textMessage = this._eleRef.nativeElement.querySelector('textarea#agensMessage');
    let textMessage = this.queryMessage.nativeElement;

    let elapsedSeconds = 0;
    this.elapsedTimeHandler = setInterval(function(){
      elapsedSeconds += 1;
      let elapsedTimeText = elapsedSeconds+' seconds';
      if( elapsedSeconds >= 60 ) elapsedTimeText = Math.floor(elapsedSeconds/60)+' minutes '+(elapsedSeconds%60)+' seconds'
      // 1초마다 메시지 출력
      this.resultMessage = { fontColor: 'darkgray', text: elapsedTimeText };
      textMessage.value = `[Executing] elapsed ${elapsedTimeText} ...`;
      textMessage.style.color = this.resultMessage.fontColor;
    }, 1000);
  }

  // call API: db
  runQuery( callback:()=>void = undefined ){

    let sql:string = this.makeupSql(<string> this.editor.getValue());
    if( sql.length < 5 ) return;

    // 이전 결과들 비우고
    this.clearResults();
    this.displayRunningTime();

    const url = `${this._agens.api.CORE}/query`;
    // **NOTE: encodeURIComponent( sql ) 처리
    // (SQL문의 '+','%','&','/' 등의 특수문자 변환)
    let params:HttpParams = new HttpParams().set('sql', encodeURIComponent( sql ) );
    this.httpRequest = this._http.get<IResultDto>(url, {params: params, headers: this.createAuthorizationHeader()})
      .subscribe(
        data => {
          // 메시지 출력 borderColor : 정상 #0099ff, 오류 #ea614a
          if( data.state.valueOf() === 'FAIL' ){
            this.resultMessage = { fontColor: '#ea614a', text: `[${data.state}] ${data.message}` };
            this.resultDto = null;
          }
          else{
            this.resultMessage = { fontColor: '#0099ff', text: `[${data.state}] ${data.message}` };
            // 변수에 저장
            this.resultDto = <IResultDto>data;
          }
          let textMessage:any = this._eleRef.nativeElement.querySelector('textarea#agensMessage');
          textMessage.style.color = this.resultMessage.fontColor;
          textMessage.value = this.resultMessage.text;

          this._angulartics2.eventTrack.next({ action: 'runQuery', properties: { category: 'graph', label: data.message }});
        },
        (err:HttpErrorResponse) => {
          this.isLoading = false;
          if( this.elapsedTimeHandler !== null ){
            clearInterval(this.elapsedTimeHandler);
          }

          console.log('HttpErrorResponse:',err);
          if (!(err.error instanceof Error)) {
            console.log(`<ERROR> query: state=${err.error.state}, message=${err.error.message}, _link=${err.error._link}`);
            // 메시지 출력
            this.resultMessage = { fontColor: '#ea614a', text: `[${err.error.state}] ${err.error.message}` };

            this._angulartics2.eventTrack.next({ action: 'error', properties: { category: 'graph', label: err.error.message }});
          }
        },
        () => {
          // 결과값 나눠먹기
          if( this.resultDto !== null ){
            if( this.resultDto.graph !== null ) this.showResultGraph(this.resultDto.db);
            if( this.resultDto.record !== null ) this.showResultRecord(this.resultDto.record);
          }

          this.isLoading = false;
          if( this.elapsedTimeHandler !== null ){
            clearInterval(this.elapsedTimeHandler);
          }

          // callback function run
          if( callback !== undefined ) callback();
        });
  }

  // when button "STOP" click
  stopQuery(){
    // unsubscribe
    if( this.httpRequest !== null ) this.httpRequest.unsubscribe();
    // stop timer
    if( this.elapsedTimeHandler !== null ){
      clearInterval(this.elapsedTimeHandler);
      this.elapsedTimeHandler = null;
    }
    // display user cancel message
    if( this.isLoading ) {
      this.resultMessage = { fontColor: '#ea614a', text: '[Cancel] User aborts query request.' };
      this.isLoading = false;

      let textMessage = this._eleRef.nativeElement.querySelector('textarea#agensMessage');
      this._angulartics2.eventTrack.next({ action: 'stopQuery', properties: { category: 'graph', label: textMessage.value }});
    }
  }

  // call API: db
  runExpandTo( sql:string, expandId:string, boundingBox:any ){

    this.isLoading = true;
    this.resultExpandTo = null;

    const url = `${this._agens.api.CORE}/query`;
    let params:HttpParams = new HttpParams();
    params = params.append('sql', encodeURIComponent( sql ) );
    params = params.append('options', 'loggingOff');

    this.httpRequest = this._http.get<IResultDto>(url, {params: params, headers: this.createAuthorizationHeader()})
      .subscribe(
        data => {
          // 메시지 출력 : 정상 #0099ff, 오류 #ea614a
          if( data.state.valueOf() === 'SUCCESS' ){
            // 기존 graph data에 추가
            this.resultExpandTo = <IResultDto>data;
          }
        },
        (err:HttpErrorResponse) => {
          this.isLoading = false;
        },
        () => {
          this.isLoading = false;
          if( this.resultExpandTo !== null ) this.mergeExpandToGraph(this.resultExpandTo, expandId, boundingBox);
        });
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // graph 데이터
  showResultGraph(data:IGraph){
    if( data === null || data.nodes === null || data.nodes.length === 0 ) return;

    // label chips
    this.graphLabels = data.meta;

    // show graphProgressBar
    let graphProgressBar:any = document.querySelector('div#graphProgressBar');
    graphProgressBar.style.visibility = 'visible';   // hidden

    // -----------------------------------------------

    // clear
    this.graphAgens.elements().remove();

    // make stats : { nodeLabelSize, edgeLabelSize }
    this.resultStats = this.makeResultStats(data);
    // label color injection : add $$color property ==> ILabelType, INode.data, IEdge.data
    this.randomStyleInjection(data, this.resultStats);
    // data import
    this.graphAgens.add(data);
    // adjust MENU on nodes
    this.adjustMenuOnNode( data.meta, this.graphAgens.nodes() );

    // layout 자동 선택
    // run layout (default: cose) : edge가 없거나 node가 많은 경우엔 grid 적용
    let layoutName = 'cose';
    let targetsRate = this.graphAgens.edges().targets().size() / data.nodes.length;
    let sourcesRate = this.graphAgens.edges().sources().size() / data.nodes.length;
    if( Math.abs(targetsRate-sourcesRate) > 0.6 && (targetsRate > 0.8 || sourcesRate > 0.8) ) layoutName = 'concentric';
    if( data.edges.length/data.nodes.length < 0.6 || data.edges.length <= 4 ) layoutName = 'grid';
    if( data.nodes.length > 400 ) layoutName = 'grid';

    console.log( `stats: nodes=${data.nodes.length} (${Math.floor(sourcesRate*100)/100}|${Math.floor(targetsRate*100)/100}), edges=${data.edges.length}` );

    let layoutHandler = this.graphAgens.makeLayout(this._window.agens.graph.layoutTypes[layoutName]);
    layoutHandler.pon('layoutstart').then(function(){
      // 최대 1.5초(1500ms) 안에는 멈추도록 설정
      setTimeout(function(){
        layoutHandler.stop();
      }, 1500);
    });
    layoutHandler.pon('layoutstop').then(function(e){
      e.cy.resize();
      // hide graphProgressBar
      let graphProgressBar:any = document.querySelector('div#graphProgressBar');
      graphProgressBar.style.visibility = 'hidden';   //visible
    });
    layoutHandler.run();
  }

  adjustMenuOnNode(labels: Array<ILabelType>, collection:any ){
    // copy label's neighbors to nodes
    if( labels !== undefined ){
      labels.forEach(label => {
        let nodes = collection.filter((i,elem) => {
          return elem.data('labels')[0] === label.name;
        });
        nodes.forEach(elem => {
          nodes.data('neighbors', [...label.neighbors]);
        });
      });
    }

    //
    // **NOTE: cy.on('cxttap', fun..) 구문을 사용하면 안먹는다 (-_-;)
    //
    // mouse right button click event on nodes
    collection.qtip({
      content: function() {
        // return 'Example qTip on ele ' + this.id();
        let menuHtml:string = '<div class="hide-me"><h4>expandTo ('+this.data('labels')[0]+')</h4><hr/><ul>';
        let neighbors = this.data('neighbors');
        if( neighbors !== undefined && neighbors.length > 0 ){
          neighbors.forEach( item => {
            menuHtml += '<li><a href="javascript:void(0);" onclick="if( agens.cy.cyQtipMenuCallback !== undefined ) '
                        + `agens.cy.cyQtipMenuCallback('${this.id()}', '${item}');">${item}`
                        + ' <i class="fa fa-angle-double-right" aria-hidden="true"></i></a></li>';
          });
        }
        else{
          menuHtml += '<li><span>no neighbor</span></li>';
        }
        return menuHtml+'</ul></div>';
      },
      style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
      position: { target: 'mouse', adjust: { mouse: false } },
      events: { visible: function(event, api) { $('.qtip').click(function(){ $('.qtip').hide(); }); } },
      show: { event: 'cxttap' },          // cxttap: mouse right button click event
      hide: { event: 'click unfocus' }
    });
  }

  mergeExpandToGraph( data:IResultDto, expandId:string, boundingBox:any ){

    // add nodes
    let expandNodes = this.graphAgens.collection( data.graph.nodes );
    expandNodes.forEach(elem => {
      elem.data('$$expandid', expandId);
      elem.addClass('expand');
    });
    this.graphAgens.add( expandNodes );
    // adjust menu on nodes
    this.adjustMenuOnNode( data.graph.meta, expandNodes );

    // add edges : node가 있어야 edge 생성 가능
    let expandEdges = this.graphAgens.collection( data.graph.edges );
    expandEdges.forEach(elem => {
      elem.data('$$expandid', expandId);
      elem.addClass('expand');
    });
    this.graphAgens.add( expandEdges );

    let expandLayout:any = {
      name: 'concentric',
      fit: true,                          // whether to fit the viewport to the graph
      padding: 50,                        // the padding on fit
      startAngle: 3 / 2 * Math.PI,        // where nodes start in radians
      sweep: undefined,                   // how many radians should be between the first and last node (defaults to full circle)
      clockwise: true,                    // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
      equidistant: false,                 // whether levels have an equal radial distance betwen them, may cause bounding box overflow
      minNodeSpacing: 10,                 // min spacing between outside of nodes (used for radius adjustment)
      boundingBox: boundingBox,           // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      avoidOverlap: true,                 // prevents node overlap, may overflow boundingBox if not enough space
      nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
      concentric: function( node ){ return node.degree(); },  // returns numeric value for each node, placing higher nodes in levels towards the centre
      levelWidth: function( nodes ){ return nodes.maxDegree() / 4; }, // the variation of concentric values in each level
      animate: false,                     // whether to transition the node positions
    };

    setTimeout(function(){
      agens.cy.elements(':selected').unselect();
      let expands = agens.cy.elements().filter((i,elem) => {
        return elem.data('$$expandid') !== undefined && elem.data('$$expandid') === expandId;
      });
      let layoutHandler = expands.makeLayout(expandLayout);
      layoutHandler.pon('layoutstop').then(function(e){
        // 화면에 맞게 elements 정렬
        e.cy.fit( e.cy.elements(), 50 );
        // 후처리
        expands.select();
      });
      layoutHandler.run();
    }, 100);
  }

  // return ==> resultStas { nodeLabelSize, edgeLabelSize }
  makeResultStats(data:IGraph): any {
    let stats:any = { nodeLabelSize: 0, edgeLabelSize: 0 };
    for( let label of data.meta ){
      if( label.type === CONFIG.ElemType.NODE ) stats.nodeLabelSize += 1;
      else if( label.type === CONFIG.ElemType.EDGE ) stats.edgeLabelSize += 1;
    }
    return stats;
  }

  // add $$color property ==> ILabelType, INode.data, IEdge.data
  // ** 참고: https://github.com/davidmerfield/randomColor
  randomStyleInjection(data:IGraph, stats:any){
    // add $$color ==> ILabelType
    let labelIndex = 0;
    for( let label of data.meta ){
      if( label.type === CONFIG.ElemType.NODE ){
        // ILabelType 에 $$style 삽입
        label['$$style'] = { color: this.labelColors[labelIndex%MAX_COLOR_SIZE], size: '55px', label: null };
        // INode 에 $$style 삽입 => IStyle { _self: { color: null, size: null }, _label: { color: ??, size: ?? }}
        data.nodes
            .filter((item) => { return (item.data.labels !== null ) && (item.data.labels[0] === label.name); })
            .map((item) => {
              item.data['$$style'] = { _self: { color: null, size: null, label: null }, _label: label['$$style'] };
            });
      }
      else if( label.type === CONFIG.ElemType.EDGE ){
        // ILabelType 에 $$color 삽입
        label['$$style'] = { color: this.labelColors[labelIndex%MAX_COLOR_SIZE], size: '2px', label: '' };
        // IEdge 에 $$style 삽입 => IStyle { _self: { color: null, size: null }, _label: { color: ??, size: ?? }}
        data.edges
            .filter((item) => { return (item.data.labels !== null ) && (item.data.labels[0] === label.name); })
            .map((item) => {
              item.data['$$style'] = { _self: { color: null, size: null, label: null }, _label: label['$$style'] };
            });
      }
      labelIndex += 1;
    }
  }

  clickGraphLabelChip( labelType:string, labelName:string ): void {

    // 전체 unselect
    this.graphAgens.elements().unselect();

    let elements:Array<any>;
    if( labelType === 'EDGE' ) elements = this.graphAgens.edges();
    else elements = this.graphAgens.nodes();

    // label 에 해당하는 element 이면 select
    for( let elem of elements ){
      if( elem.data('labels').indexOf(labelName) >= 0 ) elem.select();
    }

    this._angulartics2.eventTrack.next({ action: 'clickLabelChip', properties: { category: 'graph', label: labelType+'.'+labelName }});
  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    if( this._window.agens.graph === undefined || this.graphAgens === undefined ) return;

    let selectedLayout = this._window.agens.graph.layoutTypes[layout];
    if( selectedLayout === undefined ) return;

    // 선택된 elements 들이 있으면 그것들을 대상으로 실행, 없으면 전체
    let elements = this.graphAgens.elements(':selected');
    if( elements.length <= 1) elements = this.graphAgens.elements(':visible');

    // show graphProgressBar
    let graphProgressBar:any = document.querySelector('div#graphProgressBar');
    graphProgressBar.style.visibility = 'visible';   // hidden

    // adjust layout
    let layoutHandler = elements.makeLayout(selectedLayout);
    layoutHandler.pon('layoutstart').then(function(){
      // 최대 2초(1000ms) 안에는 멈추도록 설정
      setTimeout(function(){
        layoutHandler.stop();
      }, 1500);
    });
    layoutHandler.pon('layoutstop').then(function(e){
      // 화면에 맞게 elements 정렬
      e.cy.fit( e.cy.elements(), 50 );
      // e.cy.resize();
      // hide graphProgressBar
      let graphProgressBar:any = document.querySelector('div#graphProgressBar');
      graphProgressBar.style.visibility = 'hidden';   //visible
    });
    layoutHandler.run();

    this._angulartics2.eventTrack.next({ action: 'changeLayout', properties: { category: 'graph', label: layout }});
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  selectedLockToggle(cyTarget:any){
    if( cyTarget.locked() ) cyTarget.unlock();
    else cyTarget.lock();

    this._angulartics2.eventTrack.next({ action: 'toggleLock', properties: { category: 'graph', label: cyTarget.group()+'_'+cyTarget.id() }});
  }

  toggleMouseWheelZoom(checked?:boolean): void{
    if( checked === undefined ) this.btnMouseWheelZoom.checked = !this.btnMouseWheelZoom.checked;
    else this.btnMouseWheelZoom.checked = checked;

    // graph의 userZoomingEnabled 설정 변경
    if( this.btnMouseWheelZoom.checked ){
      this.graphAgens.userZoomingEnabled(true);
      this._eleRef.nativeElement.querySelector('a#btnMouseWheelZoom').style.backgroundColor = '#585858';
      this._eleRef.nativeElement.querySelector('#btnMouseWheelZoomIcon').style.color = '#eee';
    }
    else {
      this.graphAgens.userZoomingEnabled(false);
      this._eleRef.nativeElement.querySelector('a#btnMouseWheelZoom').style.backgroundColor = '#eee';
      this._eleRef.nativeElement.querySelector('#btnMouseWheelZoomIcon').style.color = '#585858';
    }

    this._angulartics2.eventTrack.next({ action: 'toogleMouse', properties: { category: 'graph', label: this.btnMouseWheelZoom.checked ? 'ON' : 'off' }});
  }

  toggleHighlightNeighbors(checked?:boolean): void{
    if( checked === undefined ) this.btnHighlightNeighbors.checked = !this.btnHighlightNeighbors.checked;
    else this.btnHighlightNeighbors.checked = checked;

    if( this.btnHighlightNeighbors.checked ){
      this._eleRef.nativeElement.querySelector('a#btnHighlightNeighbors').style.backgroundColor = '#585858';
      this._eleRef.nativeElement.querySelector('#btnHighlightNeighborsIcon').style.color = '#eee';
    }
    else{
      this._eleRef.nativeElement.querySelector('a#btnHighlightNeighbors').style.backgroundColor = '#eee';
      this._eleRef.nativeElement.querySelector('#btnHighlightNeighborsIcon').style.color = '#585858';
    }

    this._angulartics2.eventTrack.next({ action: 'toggleNeighbors', properties: { category: 'graph', label: this.btnHighlightNeighbors.checked ? 'ON' : 'off' }});
  }

  refreshCanvas(){
    this.graphAgens.resize();
    if( this.graphAgens.viewUtil !== undefined ) this.graphAgens.viewUtil.removeHighlights();
    this.graphAgens.elements(':selected').unselect();
    // this.graphAgens.fit( this.graphAgens.elements(), 50 );
  }

  /////////////////////////////////////////////////////////////////
  // Table Controllers
  /////////////////////////////////////////////////////////////////

  showResultRecord(record:IRecord){
    this.recordColumns = record.meta;
    this.recordRows = this.convertRowToAny(record.meta, record.rows);
    this.recordRowsCount = this.recordRows.length;
  }

  // rows를 변환 : Array<Array<any>> ==> Array<Map<string,any>>
  convertRowToAny(columns:Array<IColumnType>, rows:Array<Array<any>>):Array<any>{
    let tempArray: Array<any> = new Array<any>();
    for( let row of rows ){
      let temp:any = {};
      for( let col of columns ){
        let key:string = col.name;
        let val:any = row[col.index];
        temp[key] = val;
      }
      tempArray.push(temp);
    }
    return tempArray;
  }

  onActivateTableRow(event){
    // console.log('Activate Event', event);
  }

  // 늘상 보이는 것으로 변경
  showJsonFormat(col:IColumnType, row:any) {
    this.tableCell.nativeElement.style.visibility = 'visible';   // this.isJsonCell = true;
    this.selectedCell = row[col.name];
    this.selectedRowIndex = row.$$index;
    this.selectedColIndex = col.index+1;
    document.querySelector('#tableCell').scrollIntoView();

    this._angulartics2.eventTrack.next({ action: 'showJson', properties: { category: 'graph', label: col.type+'.'+col.name }});
  }

  // 클립보드에 복사하기
  copyCellValue(){
    let $temp = $("<input>");
    $("body").append($temp);
    $temp.val($("#cellValue").text()).select();
    document.execCommand("copy");
    // console.log('copyCellValue :', $("#cellValue").text());
    $temp.remove();
  }

  // table 컬럼 정렬 기능은 제거
  // ** 이유
  // 1) JSON 형태에 대해서 정렬 안됨 : Node, Edge, Graph 등
  // 2) record 크기가 1000개 이상이면 브라우저 성능상 부하 가능 ==> order by 구문으로 처리하도록 유도
  recordSort(col:IColumnType){
    //console.log('recordSort =>', col);
  }

  /////////////////////////////////////////////////////////////////
  // Dailog Controllers
  /////////////////////////////////////////////////////////////////

  openProjectSaveDialog(){

    if( this.graphAgens === null ) return;
    let sql:string = this.makeupSql(<string> this.editor.getValue());
    if( sql.length < 5 ){
      this.openSnackBar('Query Editor is empty. Graph has to be with its query','WARNING');
      return;
    }

    // graph 데이터에 Label용 meta 항목 추가 : this.graphLabels
    let graphData = this.graphAgens.json();   // elements, 등등..
    // ///////////////////////////////////////////////
    // **NOTE: label 밑에 $$elements 가 포함되어 nodes나 edges 등의 내용이 중복되어 저장됨
    //         <== 개선필요!! (전체적인 json 포맷을 고려해야)
    // ///////////////////////////////////////////////
    graphData['labels'] = [...this.graphLabels];

    // Stringify 변환
    let graph_json:string = JSON.stringify( graphData );
    if( graph_json.length < 5 ){
      this.openSnackBar('Graph is empty. Blank graph cannot be saved','WARNING');
      return;
    }

    if( this.currProject === null )
      this.currProject = <IProject>{
          id: null,
          userName: null,
          userIp: null,
          title: '',
          description: '',
          create_dt: Date.now(),    // timestamp
          update_dt: Date.now(),    // timestamp
          sql: '',
          graph_json: '{}'
        };
    this.currProject.sql = this.editor.getValue();
    this.currProject.graph_json = graph_json;

    let dialogRef = this.dialog.open(ProjectSaveDialog, {
      width: '400px', height: 'auto',
      data: this.currProject
    });

    dialogRef.afterClosed().subscribe(result => {
      if( result === null ) return;
      console.log('close ProjectSaveDialog:', result.hasOwnProperty('title') ? result['title'] : '(undefined)');
      // saved Project
      this.currProject = result;

      this._angulartics2.eventTrack.next({ action: 'saveProject', properties: { category: 'graph', label: result.userName+'.'+result.id }});
    });
  }

  openProjectOpenDialog(){
    let dialogRef = this.dialog.open(ProjectOpenDialog, {
      width: '800px', height: 'auto',
      data: this.currProject
    });

    dialogRef.afterClosed().subscribe(result => {
      if( result === null ) return;
      console.log('close ProjectOpenDialog:', result.hasOwnProperty('title') ? result['title'] : '(undefined)');
      // Project Open 위한 API 호출
      this.currProject = this.loadProject(<IProject>result);

      this._angulartics2.eventTrack.next({ action: 'openProject', properties: { category: 'graph', label: result.userName+'.'+result.id }});
    });
  }

  loadProject(data:IProject){
    // clear
    this.clearProject();
    // editor query
    this.editor.setValue(data.sql);
    let graphData:any = null;

    // json data parse
    try{
      graphData = JSON.parse( data.graph_json );
    }catch(ex){
      console.log('graph_json parse error =>', ex);
      this.openSnackBar('JSON parse error on loading project', 'ERROR');
    }

    // load graph
    if( graphData !== null ){
      // load graph data and rendering
      agens.graph.loadData( graphData );
      // load label's chips
      if( graphData.hasOwnProperty('labels') ){
        this.graphLabels = [...graphData['labels']];
        // add MENU on nodes
        this.adjustMenuOnNode( this.graphLabels, this.graphAgens.nodes() );
      }
    }
    return data;
  }

  /////////////////////////////////////////////////////////////////
  // Search in Result Dialog
  /////////////////////////////////////////////////////////////////

  openSearchResultDialog(): void {
    if( this.graphAgens.elements().length == 0 || this.graphLabels.length == 0 ) return;

    let inputData = {
      labels: this.graphLabels,
      labelPallets: this.labelColors
    };
    let dialogRef = this.dialog.open( SearchResultDialog, {
      width: '400px', height: 'auto',
      data: inputData
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('SearchResultDialog was closed:', result );
      if( result === null ) return;

      result.select().addClass('highlighted');
    });
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////

  openLabelStyleSettingDialog(): void {
    if( this.graphAgens.elements().length == 0 || this.graphLabels.length == 0 ) return;

    let inputData = {
      labels: this.graphLabels,
      labelPallets: this.labelColors
    };
    let dialogRef = this.dialog.open( LabelStyleSettingDialog, {
      width: '400px', height: 'auto',
      data: inputData
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('LabelStyleSettingDialog was closed:', result );
      if( result === null ) return;

      this.changeLabelStyle(result);
    });
  }

  // 라벨에 대한 스타일 바꾸기
  // **NOTE: project load 한 상태에서는 resultDto가 없기 때문에
  //          graphLabels 와 graphData 내에서만 해결해야 한다!!
  private changeLabelStyle(styleChange:any){

    // 1) ILabelType.$$style 변경,
    let label:ILabelType = this.graphLabels.filter(function(val){ return styleChange.target === val.oid; })[0];
    label['$$style'] = { color: styleChange.color, size: styleChange.size+'px', label: styleChange.title };

    // 2) graphAgens.elements() 중 해당 label 에 대한 $$style 변경
    let elements = [];
    if( label.type.valueOf() === 'NODE' ) elements = this.graphAgens.nodes();
    else elements = this.graphAgens.edges();
    for( let i=0; i<elements.length; i+= 1){
      if( elements[i].data('labels').indexOf(label.name) >= 0 ){
        elements[i].data('$$style', { _self: { color: null, size: null, label: null }, _label: label['$$style'] });
      }
    }

    // 3) apply
    this.graphAgens.style().update();

    this._angulartics2.eventTrack.next({ action: 'changeStyle', properties: { category: 'graph', label: label.type+'.'+label.name }});
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////

  openImageExportDialog(){
    // recordTable에 결과가 없어도 graph 에 출력할 내용물이 있으면 OK!
    if( this.graphAgens.elements(':visible').length === 0 ) return;

    let dialogRef = this.dialog.open(ImageExportDialog, {
      width: 'auto', height: 'auto',
      data: this.graphAgens
    });

    dialogRef.afterClosed().subscribe(result => {
      if( result === null ) return;

      // agens.graph.exportImage 호출
      agens.graph.exportImage( result.filename, result.watermark );

      this._angulartics2.eventTrack.next({ action: 'exportImage', properties: { category: 'graph', label: result.filename }});
    });
  }

  /////////////////////////////////////////////////////////////////
  // Centrality methods
  /////////////////////////////////////////////////////////////////

  centralrityPR(){
    let centrality = agens.cy.elements().pageRank();
    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityPr', centrality.rank(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityPr') < acc[0] ) ? cur.scratch('_centralrityPr') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityPr') > acc[1] ) ? cur.scratch('_centralrityPr') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityPr') : acc[2] + cur.scratch('_centralrityPr');   // sum
        return acc;
      }, []);
    console.log( 'pageRank Centrality: ', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityPr') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }

  centralrityDg(){
    let centrality = agens.cy.elements().degreeCentralityNormalized();
    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityDg', centrality.degree(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityDg') < acc[0] ) ? cur.scratch('_centralrityDg') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityDg') > acc[1] ) ? cur.scratch('_centralrityDg') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityDg') : acc[2] + cur.scratch('_centralrityDg');   // sum
        return acc;
      }, []);
    console.log( 'Degree Centrality: ', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityDg') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }

  centralrityCn(){
    let centrality = agens.cy.elements().closenessCentralityNormalized();

    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityCn', centrality.closeness(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityCn') < acc[0] ) ? cur.scratch('_centralrityCn') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityCn') > acc[1] ) ? cur.scratch('_centralrityCn') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityCn') : acc[2] + cur.scratch('_centralrityCn');   // sum
        return acc;
      }, []);
    console.log( 'Closeness Centrality:', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityCn') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }
  
  centralrityBt(){
    let centrality = agens.cy.elements().betweennessCentrality();

    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityBt', centrality.betweenness(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityBt') < acc[0] ) ? cur.scratch('_centralrityBt') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityBt') > acc[1] ) ? cur.scratch('_centralrityBt') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityBt') : acc[2] + cur.scratch('_centralrityBt');   // sum
        return acc;
      }, []);
    console.log( 'Betweenness Centrality:', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityBt') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }

}
