import { Component, OnInit, NgZone, ViewChild, ElementRef } from '@angular/core';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { AgensUtilService } from '../../../../services/agens-util.service';
import { ILabel } from '../../../../models/agens-data-types';
import * as CONFIG from '../../../../global.config';

declare var agens: any;

@Component({
  selector: 'app-query-graph',
  templateUrl: './query-graph.component.html',
  styleUrls: ['./query-graph.component.scss']
})
export class QueryGraphComponent implements OnInit {

  cy: any = undefined;
  labels: ILabel[] = [];

  selectedElement: any = null;
  // neighbors 선택시 select 추가를 위한 interval 목적
  timeoutNodeEvent: any = null;

  // pallets : Node 와 Edge 라벨별 color 셋
  labelColors: any[] = [];

  // material elements
  @ViewChild('btnMouseWheelZoom') public btnMouseWheelZoom: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _ngZone: NgZone,    
    private dialog: MatDialog,
    private _util: AgensUtilService,
  ) { 
  }

  ngOnInit() {
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
    // 내부-외부 함수 공유 해제
    window['angularComponentRef'] = null;
  }

  ngAfterViewInit() {
    // Cytoscape 생성
    if( !this.cy ) {
      this.cy = agens.graph.graphFactory(
        this.divCanvas.nativeElement, {
          selectionType: 'additive',    // 'single' or 'additive'
          boxSelectionEnabled: true, // if single then false, else true
          useCxtmenu: true,          // whether to use Context menu or not
          hideNodeTitle: true,       // hide nodes' title
          hideEdgeTitle: true,       // hide edges' title
        });
    }

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

  cyQtipMenuCallback( target:any, targetLabel:string ){
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
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // 결과들만 삭제 : runQuery 할 때 사용
  clearResults(){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    this.graphLabels = [];
    // 그래프 관련 콘트롤러들 초기화
    this.toggleMouseWheelZoom(false);
    this.toggleHighlightNeighbors(false);
    this.selectedElement = null;
  }

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
    this.cy.elements().remove();

    // make stats : { nodeLabelSize, edgeLabelSize }
    this.resultStats = this.makeResultStats(data);
    // label color injection : add $$color property ==> ILabelType, INode.data, IEdge.data
    this.randomStyleInjection(data, this.resultStats);
    // data import
    this.cy.add(data);
    // adjust MENU on nodes
    this.adjustMenuOnNode( data.meta, this.cy.nodes() );

    // layout 자동 선택
    // run layout (default: cose) : edge가 없거나 node가 많은 경우엔 grid 적용
    let layoutName = 'cose';
    let targetsRate = this.cy.edges().targets().size() / data.nodes.length;
    let sourcesRate = this.cy.edges().sources().size() / data.nodes.length;
    if( Math.abs(targetsRate-sourcesRate) > 0.6 && (targetsRate > 0.8 || sourcesRate > 0.8) ) layoutName = 'concentric';
    if( data.edges.length/data.nodes.length < 0.6 || data.edges.length <= 4 ) layoutName = 'grid';
    if( data.nodes.length > 400 ) layoutName = 'grid';

    console.log( `stats: nodes=${data.nodes.length} (${Math.floor(sourcesRate*100)/100}|${Math.floor(targetsRate*100)/100}), edges=${data.edges.length}` );

    let layoutHandler = this.cy.makeLayout(this._window.agens.graph.layoutTypes[layoutName]);
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
    let expandNodes = this.cy.collection( data.graph.nodes );
    expandNodes.forEach(elem => {
      elem.data('$$expandid', expandId);
      elem.addClass('expand');
    });
    this.cy.add( expandNodes );
    // adjust menu on nodes
    this.adjustMenuOnNode( data.graph.meta, expandNodes );

    // add edges : node가 있어야 edge 생성 가능
    let expandEdges = this.cy.collection( data.graph.edges );
    expandEdges.forEach(elem => {
      elem.data('$$expandid', expandId);
      elem.addClass('expand');
    });
    this.cy.add( expandEdges );

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
    for( let label of data.labels ){
      if( label.type === 'NODE' ) stats.nodeLabelSize += 1;
      else if( label.type === 'EDGE' ) stats.edgeLabelSize += 1;
    }
    return stats;
  }

  // add $$color property ==> ILabelType, INode.data, IEdge.data
  // ** 참고: https://github.com/davidmerfield/randomColor
  randomStyleInjection(data:IGraph, stats:any){
    // add $$color ==> ILabelType
    let labelIndex = 0;
    for( let label of data.labels ){
      if( label.type === 'NODE' ){
        // ILabelType 에 $$style 삽입
        label['$$style'] = { color: this.labelColors[labelIndex%CONFIG.MAX_COLOR_SIZE], size: '55px', label: null };
        // INode 에 $$style 삽입 => IStyle { _self: { color: null, size: null }, _label: { color: ??, size: ?? }}
        data.nodes
            .filter((item) => { return (item.data.labels !== null ) && (item.data.labels[0] === label.name); })
            .map((item) => {
              item.data['$$style'] = { _self: { color: null, size: null, label: null }, _label: label['$$style'] };
            });
      }
      else if( label.type === 'EDGE' ){
        // ILabelType 에 $$color 삽입
        label['$$style'] = { color: this.labelColors[labelIndex%CONFIG.MAX_COLOR_SIZE], size: '2px', label: '' };
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
    this.cy.elements().unselect();

    let elements:Array<any>;
    if( labelType === 'EDGE' ) elements = this.cy.edges();
    else elements = this.cy.nodes();

    // label 에 해당하는 element 이면 select
    for( let elem of elements ){
      if( elem.data('labels').indexOf(labelName) >= 0 ) elem.select();
    }

    this._angulartics2.eventTrack.next({ action: 'clickLabelChip', properties: { category: 'graph', label: labelType+'.'+labelName }});
  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    if( this._window.agens.graph === undefined || this.cy === undefined ) return;

    let selectedLayout = this._window.agens.graph.layoutTypes[layout];
    if( selectedLayout === undefined ) return;

    // 선택된 elements 들이 있으면 그것들을 대상으로 실행, 없으면 전체
    let elements = this.cy.elements(':selected');
    if( elements.length <= 1) elements = this.cy.elements(':visible');

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
      this.cy.userZoomingEnabled(true);
      this._eleRef.nativeElement.querySelector('a#btnMouseWheelZoom').style.backgroundColor = '#585858';
      this._eleRef.nativeElement.querySelector('#btnMouseWheelZoomIcon').style.color = '#eee';
    }
    else {
      this.cy.userZoomingEnabled(false);
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
    this.cy.resize();
    if( this.cy.viewUtil !== undefined ) this.cy.viewUtil.removeHighlights();
    this.cy.elements(':selected').unselect();
    // this.cy.fit( this.cy.elements(), 50 );
  }

  /////////////////////////////////////////////////////////////////
  // Search in Result Dialog
  /////////////////////////////////////////////////////////////////

  openSearchResultDialog(): void {
    if( this.cy.elements().length == 0 || this.graphLabels.length == 0 ) return;

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
    if( this.cy.elements().length == 0 || this.graphLabels.length == 0 ) return;

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
    if( label.type.valueOf() === 'NODE' ) elements = this.cy.nodes();
    else elements = this.cy.edges();
    for( let i=0; i<elements.length; i+= 1){
      if( elements[i].data('labels').indexOf(label.name) >= 0 ){
        elements[i].data('$$style', { _self: { color: null, size: null, label: null }, _label: label['$$style'] });
      }
    }

    // 3) apply
    this.cy.style().update();

    this._angulartics2.eventTrack.next({ action: 'changeStyle', properties: { category: 'graph', label: label.type+'.'+label.name }});
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////

  openImageExportDialog(){
    // recordTable에 결과가 없어도 graph 에 출력할 내용물이 있으면 OK!
    if( this.cy.elements(':visible').length === 0 ) return;

    let dialogRef = this.dialog.open(ImageExportDialog, {
      width: 'auto', height: 'auto',
      data: this.cy
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
