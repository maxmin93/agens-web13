import { Component, AfterViewInit, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse, HttpEventType, HttpResponse } from '@angular/common/http';
import { Router, } from '@angular/router';

// materials
import { MatDialog, MatSnackBar, MatButtonToggle, MatInput } from '@angular/material';
import { MatTabGroup } from '@angular/material/tabs';

import { Observable, Subscription, of } from 'rxjs';
import { filter, share, concatAll } from 'rxjs/operators';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import { StateType } from '../../app.config';

import { IResultDto, IResponseDto, IGraphDto } from '../../models/agens-response-types';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IRecord, IColumn, IRow, IEnd } from '../../models/agens-data-types';
import { IProject } from '../../models/agens-manager-types';

// Components
import { QueryResultComponent } from './components/query-result/query-result.component';
import { QueryGraphComponent } from './components/query-graph/query-graph.component';
import { QueryTableComponent } from './components/query-table/query-table.component';
import { StatGraphComponent } from './components/stat-graph/stat-graph.component';

// Dialogs
import { ProjectOpenDialog } from './dialogs/project-open-dialog';
import { ProjectSaveDialog } from './dialogs/project-save-dialog';

import * as _ from 'lodash';
import * as moment from 'moment';

declare var CodeMirror: any;
declare var agens: any;
declare var saveAs: any;      // file-saver

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements AfterViewInit, OnInit, OnDestroy {

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined
  ];
  private subscription_meta: Subscription = undefined;
  public project: any = undefined;

  // controll whether make buttons to able or disable
  isExpanded: boolean = false;
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  query:string =
`match path1=(c:customer)-[]->(:"order")-[]->(p:product)-[]-(t:category)
where c.id in ['CENTC','NORTS','SPECD','GROSR','THEBI','FRANR'] and t.id in [4,8,7]
match path2=(:category)-[]->(customer)
return path1, path2;
`;
// `match path=(c:customer)-[]->(o:"order")-[]->(p:product)-[]->()
// return path limit 20;
//  `;

  // core/query API 결과
  gid:number = -1;
  private resultDto: IResultDto = undefined;
  private resultGraph: IGraph = undefined;
  private resultRecord: IRecord = undefined;
  private resultMeta: IGraph = undefined;
  private resultTemp: IGraph = undefined;

  private projectDto: IGraphDto = undefined;
  currProject: IProject =  <IProject>{
    id: null,
    title: '',
    description: '',
    sql: '',
    graph: null,
    image: null
  };
  currentTabIndex: number = 0;

  @ViewChild('uploader', {read: ElementRef}) uploader: ElementRef;
  @ViewChild('queryEditor', {read: ElementRef}) queryEditor: ElementRef;
  @ViewChild('queryResult') queryResult: QueryResultComponent;

  @ViewChild('resultTapGroup') tapGroup: MatTabGroup;

  @ViewChild('queryGraph') queryGraph: QueryGraphComponent;
  @ViewChild('queryTable') queryTable: QueryTableComponent;
  @ViewChild('statGraph') statGraph: StatGraphComponent;

  /////////////////////////////////////////////////////////

  // ** clear 정책
  // 1) 최초 로딩시  : newGraph
  // 2) new 버튼클릭 : newGraph
  // 3) query Run    : - 
  // 4) requery Run  : -  
  // 3) project Load : newGraph
  // 4) project Save : -
  // 5) import file  : - 

  /////////////////////////////////////////////////////////

  constructor(    
    private _cd: ChangeDetectorRef,
    private _el: ElementRef,
    private _router: Router,
    public dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { }

  ngOnInit(){
  }

  ngOnDestroy(){
    this.clearSubscriptions();
  }

  ngAfterViewInit() {
    this._api.changeMenu('graph');

    // CodeMirror : get mime type
    var mime = 'application/x-cypher-query';
    this.editor = new CodeMirror.fromTextArea( this.queryEditor.nativeElement, {
      mode: mime,
      keyMap: "sublime",
      lineNumbers: true,
      tabSize: 4,
      indentUnit: 4,
      indentWithTabs: false,
      smartIndent: true,
      styleActiveLine: true,
      matchBrackets: true,
      // autofocus: true,
      theme: 'idea'
    });
    // CodeMirror : initial value
    this.editor.setSize('100%', '100px');
    this.editor.setValue( this.query );

    // toggleComment 만 안되서 기능 구현
    this.installCodeMirrorAddons();
    this.editor.setOption("extraKeys", {
      "Ctrl-/": "toggleSqlComment"
    });

    // 
    // ** NOTE: 이거 안하면 이 아래쪽에 Canvas 영역에서 마우스 포커스 miss-position 문제 발생!!
    //
    // keyup event
    this.editor.on('keyup', (cm, e)=>{      
      if( e.keyCode == 13 ){
        setTimeout(function(){ 
          agens.cy.resize();
          cm.resize();
        }, 1);
      } 
    });
    // 
    // ** NOTE: cursor 가 사라지는 문제가 있는데 아직 해결 못했음 
    //          커서는 정상적으로 동작하나 selected-line style 에 가려 invisible 할 뿐인듯
    //
    this.editor.on('focus', (cm, e) => {
      setTimeout(()=>{ cm.refresh(); }, 1);
    });

    Promise.resolve(null).then(()=>{
      // new graph to call API
      this._api.grph_new().pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
        x => {
          // console.log( 'grph_new:', x );
          if( x.hasOwnProperty('gid') && x['gid'] > 0 ){
            this.gid = x.gid;
            this.queryGraph.setGid( x.gid );
            this.statGraph.setGid( x.gid );
            this.queryResult.setMessage(x.state, x.message);
          }
        });
    });
  }

  // **NOTE: 주석 라인에 대한 color 변경 필요 (comment style)
  private installCodeMirrorAddons(){
    var cmds = CodeMirror.commands;
    var Pos = CodeMirror.Pos;
    /////////////////////////////////////////////////////////////////////
    // addon/comment/comment.js
    cmds.toggleSqlComment = function(cm) {      
      // ** 참고 "node_modules/codemirror/mode/cypher/cypher.js",
      var options = { "fullLines":true, "lineComment": '--', "indent": true };
      var minLine = Infinity, ranges = cm.listSelections(), mode = null;
      for (var i = ranges.length - 1; i >= 0; i--) {
        var from = ranges[i].from(), to = ranges[i].to();
        if (from.line >= minLine) continue;
        if (to.line >= minLine) to = Pos(minLine, 0);
        minLine = from.line;
        if (mode == null) {
          if (cm.uncomment(from, to, options)) mode = "un";
          else { cm.lineComment(from, to, options); mode = "line"; }
        } else if (mode == "un") {
          cm.uncomment(from, to, options);
        } else {
          cm.lineComment(from, to, options);
        }
      }
    };    
  }

  tabChanged($event){
    // console.log( `tabChanged from ${this.currentTabIndex} to ${$event.index}`);
    this.currentTabIndex = $event.index;
  }

  tabAnimationDone(){
    switch( this.currentTabIndex ){
      case 0: 
          this.queryGraph.isVisible = true;
          this.statGraph.isVisible = false;
          Promise.resolve(null).then(() => this.queryGraph.refreshCanvas() );
          break;
      case 1: 
          this.queryGraph.isVisible = false;
          this.statGraph.isVisible = false;          
          Promise.resolve(null).then(() => this.queryTable.refresh() ); 
          break;
      case 2: 
          this.queryGraph.isVisible = false;
          this.statGraph.isVisible = true;
          Promise.resolve(null).then(() => this.statGraph.refreshCanvas() ); 
          break;
      default: 
          Promise.resolve(null).then(() => this.currentTabIndex = 0 );
          break;
    }
  }

  // query-graph Canvas의 초기화 작업 완료 이벤트
  // ==> Visible 상태이면 layout 적용
  initCallbackData(isVisible:boolean){
    if( isVisible ) this.queryGraph.graphPresetLayout();
    else this.queryGraph.todo$.next({ cmd: 'changeLayout', param: 'random' });
    // change Detection by force
    this._cd.detectChanges();
  }
  // stat-graph Canvas의 초기화 작업 완료 이벤트
  initCallbackStat(isVisible:boolean){
    if( isVisible ) this.statGraph.runLayout();
    else this.statGraph.todo$.next({ cmd: 'changeLayout', param: 'cose' });
    // change Detection by force
    this._cd.detectChanges();
  }

  toggleExpandEditor(){
    this.isExpanded = !this.isExpanded;

    // toggle off : canvas resize (안그러면 위치 인식 못해서 클릭 안됨)
    if( !this.isExpanded && agens.cy ){
      setTimeout(()=> {
        agens.cy.resize();
      },50);
    }
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // when button "NEW" click
  clearProject(option:boolean = true){
    this.clearResults();

    // 결과값 지우고
    this.resultDto = undefined;
    this.resultGraph = undefined;
    this.resultRecord = undefined;
    this.resultMeta = undefined;
    this.resultTemp = undefined;

    // 에디터 비우고
    this.editor.setValue('match path=()-[]->()-[]->() return path limit 100;');

    // 프로젝트 정보 지우고
    this.currProject = <IProject>{
      id: null,
      title: '',
      description: '',
      sql: '',
      graph: null,
      image: null
    };

    // util의 savePositions 지우고
    this._util.resetPositions();

    if( option ){
      this.gid = -1;
      this._api.grph_new().pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
        x => {
          // console.log( 'grph_new:', x );
          if( x.hasOwnProperty('gid') && x['gid'] > 0 ){
            this.gid = x.gid;
            this.queryGraph.setGid( x.gid );
            this.statGraph.setGid( x.gid );
            this.queryResult.setMessage(x.state, x.message);
          }
      });
    }

    // change Detection by force
    this._cd.detectChanges();
  }

  clearResults(){
    // 탭 위치 초기화 (queryGraph 탭으로)
    this.currentTabIndex = 0;

    this.queryResult.clear();
    this.queryGraph.clear();
    this.queryTable.clear();
    this.statGraph.clear();

    this.clearSubscriptions();
  }

  clearSubscriptions(){
    this.handlers.forEach(x => {
      if( x ) x.unsubscribe();
      x = undefined;
    });
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // 에디터 선택 라인만 실행할 경우 외에는 전체 반환
  getEditorSelection():string {
    let ranges = this.editor.listSelections();
    let selection:string = "";
    for (let i = ranges.length - 1; i >= 0; i--) {
      let from = ranges[i].from(), to = ranges[i].to();
      if( from.line == to.line && from.ch == to.ch ) selection = this.editor.getValue();
      else selection = this.editor.getRange(from, to);
    }
    // console.log( 'editor query:', selection );
    return selection;
  }

  // 주석라인 제외하고 전달
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

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // call API: db
  runQuery(option:boolean = false){

    this.currentTabIndex = 0;   
    let sql:string = this.makeupSql(<string> this.getEditorSelection() );
    if( sql.length < 5 ) return;

    this.queryResult.toggleTimer(true);
    this.isLoading = true;

    // 이전 결과들 비우고 (보통은 지우지 않는다)
    if(option) this.clearResults();
    // dataGraph 결과의 이전 그래프 위치를 저장하고 (덧실행하는 경우만)
    this.queryGraph.savePositions();
    
    // call API
    let data$:Observable<any> = this._api.core_query( this.gid, sql );

    // load Graph to QueryGraph
    this.parseGraphDto2Data(data$);
  }

  parseGraphDto2Data(data$:Observable<any>){

    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'result') ).subscribe(
      (x:IResultDto) => {
        this.resultDto = <IResultDto>x;
        if( x.hasOwnProperty('gid') ) {       // gid 갱신
          this.gid = x.gid;
          this.queryGraph.setGid( x.gid );
          this.statGraph.setGid( x.gid );
        }  
      },
      err => {
        console.log( 'core.query: ERROR=', err instanceof HttpErrorResponse, err.error );
        this._api.setResponses(<IResponseDto>{
          group: 'core.query',
          state: err.statusText,
          message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
        });
        
        this.clearSubscriptions();
        // login 페이지로 이동
        this._router.navigate(['/login']);
      });

    /////////////////////////////////////////////////
    // Graph 에 표시될 내용은 누적해서 유지
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        if( !this.resultGraph ){      // if not exists = NEW
          this.resultGraph = x;
          this.resultGraph.labels = new Array<ILabel>();
          this.resultGraph.nodes = new Array<INode>();
          this.resultGraph.edges = new Array<IEdge>();
        }
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // not exists
        if( this.resultGraph.labels.map(y => y.id).indexOf(x.id) == -1 ){
          x.scratch['_style'] = <IStyle>{ 
            width: (x.type == 'nodes') ? 45 : 3
            , title: 'name'
            , color: (x.type == 'nodes') ? this._util.nextColor() : undefined // this._util.getColor(0)
            , visible: true
          };
          x.scratch['_styleBak'] = _.cloneDeep(x.scratch['_style']);
          this.resultGraph.labels.push( x );
        }
        // **NOTE: labels 갱신은 맨나중에 resultGraph의 setData()에서 처리
        this.statGraph.addLabel( x );
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.resultGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            x.scratch['_style'] = label.scratch['_style'];        // label 에 연결된 Object
            x.scratch['_styleBak'] = label.scratch['_styleBak'];
          });

        // not exists
        if( this.resultGraph.nodes.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.nodes.push( x );
        } 
        this.queryGraph.addNode( x );
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
          .filter(val => val.type == 'edges' && val.name == x.data.label)
          .map(label => {
            x.scratch['_style'] = label.scratch['_style'];        // label 에 연결된 Object
            x.scratch['_styleBak'] =label.scratch['_styleBak'];
          });

        // not exists
        if( this.resultGraph.edges.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.edges.push( x );  
        } 
        this.queryGraph.addEdge( x );
      });
    
    /////////////////////////////////////////////////
    // Table 에 표시될 내용은 항상 최신 결과로만 유지 
    this.handlers[5] = data$.pipe( filter(x => x['group'] == 'record') ).subscribe(
      (x:IRecord) => {
        this.resultRecord = x;
        this.resultRecord.columns = new Array<IColumn>();
        this.resultRecord.rows = new Array<IRow>();
      });
    this.handlers[6] = data$.pipe( filter(x => x['group'] == 'columns') ).subscribe(
      (x:IColumn) => {
        this.resultRecord.columns.push( x );
      });
    this.handlers[7] = data$.pipe( filter(x => x['group'] == 'rows') ).subscribe(
      (x:IRow) => {
        this.resultRecord.rows.push( x );
      });

    /////////////////////////////////////////////////
    // Graph의 Label 별 카운팅 해서 갱신
    //  ==> ILabel.size, IGraph.labels_size/nodes_size/edges_size
    this.handlers[8] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.isLoading = false;
        this.queryResult.setData(<IResponseDto>this.resultDto);   // 메시지 출력

        // send data to Canvas
        this.queryGraph.setData(this.resultGraph);
        this.queryGraph.initCanvas(false);

        // send data to Table 
        this.queryTable.setData(this.resultRecord);
      });
  }

  // when button "STOP" click
  stopQuery(){
    this.isLoading = false;
    this.queryResult.abort();
    
    this.clearSubscriptions();

    // change Detection by force
    this._cd.detectChanges();
  }

  /////////////////////////////////////////////////////////////////
  // Project save, load
  /////////////////////////////////////////////////////////////////

  // ** SAVE 전략
  // 1) tinkerGraph 에 position과 style 데이터 전송 (updateGraph)
  // 1-1) props 에 '$$style'과 '$$position' 으로 저장
  // 2) tinkerGraph 에서 writeGraph 로 graphson 출력
  // 3) project table 에 graph_json 에 저장

  openProjectSaveDialog(){

    if( !this.resultGraph ){
      this._api.setResponses(<IResponseDto>{
        group: 'project::save',
        state: StateType.WARNING,
        message: 'Graph is empty. Blank graph cannot be saved'
      });
      return;
    }
    // Stringify 변환
    let graph_json:string = JSON.stringify( this.queryGraph.cy.json() );

    let sql:string = this.makeupSql(<string> this.editor.getValue());
    if( sql.length < 5 ){
      this._api.setResponses(<IResponseDto>{
        group: 'project::save',
        state: StateType.WARNING,
        message: 'Query Editor is empty. Graph has to be with its query'
      });
      return;
    }

    // update all graph (without data) : style, classes, position

    // **NOTE: 저장될 특수 변수들
    // ele.scratch('_style') => props['$$style'] = { color, width, title }
    // ele.position() => props['$$position'] = { x, y }
    // ele.classes => props['$$classes'] = '<class> ..'

    let nodes = this.queryGraph.cy.nodes().map(e => {
      let x = e.json();
      let data = { "group": x.group, "id": x.data.id, "label": x.data.label
          , "props": x.data.hasOwnProperty('props') && x.data.props ? x.data.props : {} 
          };
      if( x.position && x.position != {} ) data['props']['$$position'] = x.position;
      if( x.classes ) data['props']['$$classes'] = x.classes;
      if( e.scratch('_style') ) data['props']['$$style'] = e.scratch('_style');
      return data;
    });
    let edges = this.queryGraph.cy.edges().map(e => {
      let x = e.json();
      let data = { "group": x.group, "id": x.data.id, "label": x.data.label
          , "props": x.data.hasOwnProperty('props') && x.data.props ? x.data.props : {} 
          , "source": x.data.source, "target": x.data.target };
      // edge는 position 정보가 없음
      if( x.classes ) data['props']['$$classes'] = x.classes;
      if( e.scratch('_style') ) data['props']['$$style'] = e.scratch('_style');
      return data;
    });

    this.currProject.sql = this.editor.getValue();
    this.currProject.graph = { "labels": [], "nodes": nodes, "edges": edges };
    this.currProject.image = this.queryGraph.cy.png({ full: true, scale: 0.5, maxWidth:200, maxHeight:250 });

    // make snapshot image of GRAPH
    // 참고 https://stackoverflow.com/questions/24218382/how-to-upload-encoded-base64-image-to-the-server-using-spring

    // let png64 = this.queryGraph.cy.png({ full : true });
    // let imageBlob = this._util.dataURItoBlob(png64);

    let dialogRef = this.dialog.open(ProjectSaveDialog, {
      width: 'auto', height: 'auto',
      data: { "gid": this.queryGraph.gid, "project": this.currProject }
    });

    dialogRef.afterClosed().subscribe(result => {
      if( result === null ) return;
      // console.log('close ProjectSaveDialog:', result.id, result.hasOwnProperty('title') ? result['title'] : '(undefined)');
      // saved Project
      this.currProject = result;

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  /////////////////////////////////////////////////////////////////
  // Project load
  /////////////////////////////////////////////////////////////////

  openProjectOpenDialog(){
    let dialogRef = this.dialog.open(ProjectOpenDialog, {
      width: 'auto', height: 'auto',
      data: this.currProject            // **NOTE: dialog 에 undefined 를 전달하면 오류 발생 
    });

    dialogRef.afterClosed().subscribe(result => {
      if( !result ) return;
      // console.log('ProjectOpenDialog:', result);

      // Project Open 위한 API 호출
      this.currProject = result;
      // clear
      this.clearProject(false);    // if or not do new Graph 
      // editor query
      this.editor.setValue(result.sql);

      // **NOTE: load 대상 graph 에 아직 gid 연결 안했음 (2018-10-12)
      let data$:Observable<any> = this._api.grph_load(result.id);
      // load GraphDto to QueryGraph
      this.parseGraphDto2Project( data$ );
    });
  }

  parseGraphDto2Project( data$:Observable<any> ){

    this.queryResult.toggleTimer(true);
    this.isLoading = true;

    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        this.projectDto = x;
        if( x.hasOwnProperty('gid') ) {       // project 가 로딩된 gid 로 갱신 (새그래프)
          this.gid = x.gid;
          this.queryGraph.setGid( x.gid );
          this.statGraph.setGid( x.gid );
        }
      },
      err => {
        console.log( 'project_load: ERROR=', err instanceof HttpErrorResponse, err.error );
        this._api.setResponses(<IResponseDto>{
          group: 'project::load',
          state: err.statusText,
          message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
        });
        
        this.clearSubscriptions();
        // login 페이지로 이동
        this._router.navigate(['/login']);
      });

    /////////////////////////////////////////////////
    // Graph 에 표시될 내용은 누적해서 유지
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        if( !this.resultGraph ){      // if not exists = NEW
          this.resultGraph = x;
          this.resultGraph.labels = new Array<ILabel>();
          this.resultGraph.nodes = new Array<INode>();
          this.resultGraph.edges = new Array<IEdge>();
        }
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // not exists
        if( this.resultGraph.labels.map(y => y.id).indexOf(x.id) == -1 ){
          // new style
          x.scratch['_style'] = <IStyle>{ 
            width: (x.type == 'nodes') ? 45 : 3
            , title: 'name'
            , color: (x.type == 'nodes') ? this._util.nextColor() : undefined // this._util.getColor(0)
            , visible: true
          };
          x.scratch['_styleBak'] = _.cloneDeep(x.scratch['_style']);

          this.resultGraph.labels.push( x );
          this.statGraph.addLabel( x );
        }
        // **NOTE: labels 갱신은 맨나중에 resultGraph의 setData()에서 처리
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.resultGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            if( !x.scratch.hasOwnProperty('_style')) x.scratch['_style'] = label.scratch['_style']; // 없으면
            x.scratch['_styleBak'] = label.scratch['_styleBak'];  // 복사본은 항상 Label의 style과 일치하도록 
          });
        // if( x.data.props.hasOwnProperty('$$style')) x.scratch['_style'] = x.data.props['$$style'];
        // if( x.data.props.hasOwnProperty('$$classes')) x.classes = x.data.props['$$classes'];
        // if( x.data.props.hasOwnProperty('$$position')) x.position = x.data.props['$$position'];

        // not exists
        if( this.resultGraph.nodes.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.nodes.push( x );
        } 
        this.queryGraph.addNode( x );
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
          .filter(val => val.type == 'edges' && val.name == x.data.label)
          .map(label => {
            if( !x.scratch.hasOwnProperty('_style')) x.scratch['_style'] = label.scratch['_style']; // 없으면
            x.scratch['_styleBak'] =label.scratch['_styleBak'];
          });
        // if( x.data.props.hasOwnProperty('$$style')) x.scratch['_style'] = x.data.props['$$style'];
        // if( x.data.props.hasOwnProperty('$$classes')) x.classes = x.data.props['$$classes'];
  
        // not exists
        if( this.resultGraph.edges.map(y => y.data.id).indexOf(x.data.id) == -1 ){
          this.resultGraph.edges.push( x );  
        } 
        this.queryGraph.addEdge( x );
      });    

    /////////////////////////////////////////////////
    // Graph의 Label 별 카운팅 해서 갱신
    //  ==> ILabel.size, IGraph.labels_size/nodes_size/edges_size
    this.handlers[8] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        // console.log('END:', this.projectDto);
        this.isLoading = false;        
        this.queryResult.setData(<IResponseDto>this.projectDto);   // 메시지 출력

        // send data to Canvas
        this.queryGraph.setData(this.resultGraph);
        // this.queryGraph.initCanvas(false);
        this.queryGraph.refreshCanvas();
      });    
  }

  uploadFile(event){
    let fileItem:File = event.target.files[0];
    this.handlers[9] = this._api.fileUpload( fileItem ).subscribe(
      x => {
        // progress return 
        // => {type: 1, loaded: 35557, total: 35557} ... {type: 3, loaded: 147}
        if( x.type === HttpEventType.UploadProgress) {
          const percentDone = Math.round(100 * ( x.loaded / x.total ) );
          if( percentDone ) this.queryResult.setMessage(StateType.PENDING, `upload.progress: ${percentDone}%` );
        } 
      },
      err => {
        this.queryResult.setMessage(StateType.FAIL, 'upload.FAIL: '+JSON.stringify(err) );
      },
      () => {
        this.queryResult.setMessage(StateType.SUCCESS, 'upload.complete: '+fileItem.name );
      }
    );
  }

  importFile(event){
    let fileItem:File = event.target.files[0];
    let fileExt = undefined
    if( fileItem.name.lastIndexOf('.') >= 0 ) 
      fileExt = fileItem.name.substring(fileItem.name.lastIndexOf('.')).toLowerCase();
    if( !fileExt || (fileExt != '.graphson' && fileExt != '.json' && fileExt != '.graphml' && fileExt != '.xml') ){
      // error message
      this.queryResult.setMessage(StateType.WARNING, `**NOTE: importable file types are graphml(xml), graphson(json)`);
      return;
    }

    // console.log( 'importFile:', fileItem,  event.target.files);
    this.handlers[9] = this._api.importFile( this.gid, fileItem ).subscribe(
      x => {
        // progress return 
        // => {type: 1, loaded: 35557, total: 35557} ... {type: 3, loaded: 147}
        if( x.type === HttpEventType.UploadProgress) {
          const percentDone = Math.round(100 * ( x.loaded / x.total ) );
          if( percentDone ) this.queryResult.setMessage(StateType.PENDING, `import.progress: ${percentDone}%` );
        }
        else if (x instanceof HttpResponse) {
          console.log('File is completely uploaded!', fileItem.name);
          // load Graph to TempGraph
          if( x.body ) this.parseGraphDto2Temp( of(x.body).pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() ) );
        }
      },
      err => {
        this.queryResult.setMessage(StateType.FAIL, 'import.FAIL: '+JSON.stringify(err) );
        this.uploader.nativeElement.value = '';
      },
      () => {
        this.queryResult.setMessage(StateType.SUCCESS, 'import.complete: '+fileItem.name );
        // **NOTE: 동일한 파일 선택시 input value 가 변하지 않아 event trigger가 발생하지 않는다
        //  ==> 초기화 해주어야 함 (참고 https://stackoverflow.com/a/30357800/6811653)
        this.uploader.nativeElement.value = '';
      }
    );
  }

  parseGraphDto2Temp( data$:Observable<any> ){

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        // console.log(`graph_dto receiving : gid=${x.gid}`);
        // gid 갱신 안함
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.resultTemp = x;
        this.resultTemp.labels = new Array<ILabel>();
        this.resultTemp.nodes = new Array<INode>();
        this.resultTemp.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        x.scratch['_style'] = <IStyle>{ 
          width: undefined, title: 'name', 
          color: (x.type == 'nodes') ? this._util.nextColor() : undefined 
          , visible: true
        };
        x.scratch['_styleBak'] = _.clone(x.scratch['_style']);
        this.resultTemp.labels.push( x );
        this.queryGraph.addLabel( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        console.log( JSON.stringify(x) );
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.resultTemp.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            if( !x.scratch.hasOwnProperty('_style') ) x.scratch['_style'] = label.scratch['_style'];
            x.scratch['_styleBak'] = label.scratch['_styleBak'];
          });
        this.resultTemp.nodes.push( x );
        this.queryGraph.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultTemp.labels
        .filter(val => val.type == 'edges' && val.name == x.data.label)
        .map(label => {
          if( !x.scratch.hasOwnProperty('_style') ) x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
        this.resultTemp.edges.push( x );
        this.queryGraph.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.queryGraph.refreshCanvas();
        // this.queryGraph.initCanvas(true);
      });
  }

  ///////////////////////////////////////////////////

  exportGraph(fileType:string){
    let fileName = `graph_${this.gid}` + (fileType == 'json' ? '.graphson' : '.graphml');

    let nodes = this.queryGraph.cy.nodes().map(e => {
      let x = e.json();
      let data = { "group": x.group, "id": x.data.id, "label": x.data.label
          , "props": x.data.hasOwnProperty('props') && x.data.props ? x.data.props : {} 
          };
      if( x.position && x.position != {} ) data['props']['$$position'] = x.position;
      if( x.classes ) data['props']['$$classes'] = x.classes;
      if( e.scratch('_style') ) data['props']['$$style'] = e.scratch('_style');
      return data;
    });
    let edges = this.queryGraph.cy.edges().map(e => {
      let x = e.json();
      let data = { "group": x.group, "id": x.data.id, "label": x.data.label
          , "props": x.data.hasOwnProperty('props') && x.data.props ? x.data.props : {} 
          , "source": x.data.source, "target": x.data.target };
      // edge는 position 정보가 없음
      if( x.classes ) data['props']['$$classes'] = x.classes;
      if( e.scratch('_style') ) data['props']['$$style'] = e.scratch('_style');
      return data;
    });
    // structure: GraphDto
    let data:any  = { "gid": this.gid, "graph": { "labels": [], "nodes": nodes, "edges": edges } };

    console.log( 'exportFile: ', fileType, data );
    this._api.exportFile(fileType, data).subscribe(
      x => {
        const blob = new Blob([x], { type: (fileType == 'json' ? 'application/json' : 'application/xml') });
        saveAs(blob, fileName);
      },
      err => {
        console.log('exportGraph ERROR:', err);
      }
    );
  }  

}
