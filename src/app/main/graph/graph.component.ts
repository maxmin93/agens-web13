import { Component, AfterViewInit, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, } from '@angular/router';

// materials
import { MatDialog, MatSnackBar, MatButtonToggle, MatInput } from '@angular/material';
import { MatTabGroup } from '@angular/material/tabs';

import { DatatableComponent } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';

import * as _ from 'lodash';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
import { SearchResultDialog } from './dialogs/search-result.dialog';
import { ProjectOpenDialog } from './dialogs/project-open-dialog';
import { ProjectSaveDialog } from './dialogs/project-save-dialog';
import { LabelStyleSettingDialog } from './dialogs/label-style-setting.dialog';
import { ImageExportDialog } from './dialogs/image-export.dialog';

declare var CodeMirror: any;
declare var agens: any;


@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements AfterViewInit, OnInit, OnDestroy {

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined
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
  private resultDto: IResultDto = undefined;
  private resultGraph: IGraph = undefined;
  private resultRecord: IRecord = undefined;
  private resultMeta: IGraph = undefined;
  private resultTemp: IGraph = undefined;

  currProject: IProject = undefined;
  currentTabIndex: number = 0;

  @ViewChild('queryEditor', {read: ElementRef}) queryEditor: ElementRef;
  @ViewChild('queryResult') queryResult: QueryResultComponent;

  @ViewChild('resultTapGroup') tapGroup: MatTabGroup;

  @ViewChild('queryGraph') queryGraph: QueryGraphComponent;
  @ViewChild('queryTable') queryTable: QueryTableComponent;
  @ViewChild('statGraph') statGraph: StatGraphComponent;

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
      autofocus: true,
      theme: 'idea'
    });
    // CodeMirror : initial value
    this.editor.setValue( this.query );
    this.editor.setSize('100%', '80px');

    // toggleComment 만 안되서 기능 구현
    this.installCodeMirrorAddons();
    this.editor.setOption("extraKeys", {
      "Ctrl-/": "toggleSqlComment"
    });

    // 
    // ** NOTE: 이거 안하면 이 아래쪽에 Canvas 영역에서 마우스 포커스 miss-position 문제 발생!!
    //
    // keyup event
    this.editor.on('keyup', function(cm, e){      
      // console.log('this.editor is keyup:', e.keyCode );
      if( e.keyCode == 13 ) agens.cy.resize();
    });      
  }

  private installCodeMirrorAddons(){
    var cmds = CodeMirror.commands;
    var Pos = CodeMirror.Pos;
    /////////////////////////////////////////////////////////////////////
    // addon/comment/comment.js
    cmds.toggleSqlComment = function(cm) {
      let ranges = cm.listSelections();
      for (let i = ranges.length - 1; i >= 0; i--) {
        let from = ranges[i].from(), to = ranges[i].to();
        for(let j = from.line; j <= to.line; j++ ){
          if( j != from.line || j != to.line ){
            if( j == from.line && from.ch == cm.getLine(j).length - 1 ) continue;
            if( j == to.line && to.ch == 0 ) continue;
          }
          let line = cm.getLine(j).trim();
          // do uncomment
          if( line.startsWith('--') ) {
            line = line.substring(2, line.length).trim();
          }
          // do comment 
          else {
            line = '-- '+line;
          }
          cm.replaceRange( line, {"line": j, "ch": 0}, {"line": j, "ch": cm.getLine(j).length })
        }
        cm.setCursor(to);
      }  
    };    
  }

  tabChanged($event){
    console.log( `tabChanged from ${this.currentTabIndex} to ${$event.index}`);
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
  clearProject(){
    this.clearResults();

    // 결과값 지우고
    this.resultDto = undefined;
    this.resultGraph = undefined;
    this.resultRecord = undefined;
    this.resultMeta = undefined;
    this.resultTemp = undefined;

    // 에디터 비우고
    this.editor.setValue('');

    // 프로젝트 정보 지우고
    this.currProject = undefined;

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
  runQuery(){

    this.queryResult.toggleTimer(true);
    this.isLoading = true;
    
    let sql:string = this.makeupSql(<string> this.getEditorSelection() );
    if( sql.length < 5 ) return;

    // 이전 결과들 비우고
    this.clearResults();

    // call API
    let data$:Observable<any> = this._api.core_query( sql );

    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'result') ).subscribe(
      (x:IResultDto) => {
        this.resultDto = <IResultDto>x;
        if( x.hasOwnProperty('gid') ) {
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

    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.resultGraph = x;
        this.resultGraph.labels = new Array<ILabel>();
        this.resultGraph.nodes = new Array<INode>();
        this.resultGraph.edges = new Array<IEdge>();
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        x.scratch['_style'] = <IStyle>{ 
                width: undefined, title: 'name', 
                color: (x.type == 'nodes') ? this._util.nextColor() : undefined 
                , visible: true
              };
        x.scratch['_styleBak'] = _.clone(x.scratch['_style']);
        this.resultGraph.labels.push( x );
        this.queryGraph.addLabel( x );
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.scratch['_neighbors'] = new Array<string>();
        this.resultGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.label)
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            x.scratch['_style'] = label.scratch['_style'];
            x.scratch['_styleBak'] = label.scratch['_styleBak'];
          });

        this.resultGraph.nodes.push( x );
        this.queryGraph.addNode( x );
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
          .filter(val => val.type == 'edges' && val.name == x.data.label)
          .map(label => {
            x.scratch['_style'] = label.scratch['_style'];
            x.scratch['_styleBak'] =label.scratch['_styleBak'];
          });

        this.resultGraph.edges.push( x );
        this.queryGraph.addEdge( x );
      });
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
    this.handlers[8] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.isLoading = false;
        this.queryResult.setData(<IResponseDto>this.resultDto);

        // send data to Canvas
        this.queryGraph.setData(this.resultGraph);
        this.queryGraph.initCanvas(false);

        // send data to Table 
        this.queryTable.setData(this.resultRecord);

        // **NOTE: 이어서 schema graph 호출 (gid)
        if( this.resultDto.hasOwnProperty('gid') && this.resultDto.gid > 0 ) 
          this.runGraphSchema( this.resultDto.gid );
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

  runGraphSchema(gid: number){
    // call API
    let data$:Observable<any> = this._api.grph_schema(gid);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`graph_dto receiving : gid=${x.gid} (${gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.resultMeta = x;
        this.resultMeta.labels = new Array<ILabel>();
        this.resultMeta.nodes = new Array<INode>();
        this.resultMeta.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // meta-graph 에는 스타일을 부여하지 않는다 (nodes, edges 둘뿐이라)
        this.resultMeta.labels.push( x );
        this.statGraph.addLabel( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.classes = 'meta';     // meta class style
        x.scratch['_neighbors'] = new Array<string>();
        this.resultGraph.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.props['name'])
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            x.scratch['_style'] = label.scratch['_style'];
            x.scratch['_styleBak'] = label.scratch['_styleBak'];
          });
        this.resultMeta.nodes.push( x );
        this.statGraph.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        x.classes = 'meta';     // meta class style
        this.resultGraph.labels
        .filter(val => val.type == 'edges' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.resultMeta.edges.push( x );
      this.statGraph.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        // // meta-graph에 대한 width 스타일만 적용 (label 스타일 연결)
        // // : newColor option = false (새로운 색상 사용 안함)
        // this._util.calcElementStyles( this.resultMeta.nodes, (x)=>40+x*5, false );
        // this._util.calcElementStyles( this.resultMeta.edges, (x)=>2+x, false );
        this.queryGraph.setMeta(this.resultMeta);
        this.statGraph.initCanvas();
      });

  }

  runGraphGroupBy($event: any){

    this.queryGraph.clear(false);   // clear canvas except labels

    // call API
    let data$:Observable<any> = this._api.grph_groupBy(this.resultDto.gid, [ $event ]);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`graph_dto receiving : gid=${x.gid} (${this.resultDto.gid})`);
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
      this.resultTemp.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.resultGraph.labels
        .filter(val => val.type == 'nodes' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_neighbors'] += label.targets;
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.resultTemp.nodes.push( x );
      this.queryGraph.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
        .filter(val => val.type == 'edges' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.resultTemp.edges.push( x );
      this.queryGraph.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        // this._util.applyLabelStyle(this.resultTemp.nodes, this.resultGraph.labels, 
        //   (ele:IElement, label:ILabel) => {
        //     return label.type == 'nodes' && ele.data['label'] == label.name;
        //   });
        // this._util.applyLabelStyle(this.resultTemp.edges, this.resultGraph.labels, 
        //   (ele:IElement, label:ILabel) => {
        //     return label.type == 'edges' && ele.data['label'] == label.name;
        //   });

        this.queryGraph.initCanvas(true);
        // this.queryGraph.graphChangeLayout('cose');
      });

  }

  /////////////////////////////////////////////////////////////////
  // Dailog Controllers
  /////////////////////////////////////////////////////////////////

  openProjectSaveDialog(){

    let sql:string = this.makeupSql(<string> this.editor.getValue());
    if( sql.length < 5 ){
      this._api.setResponses(<IResponseDto>{
        group: 'project::save',
        state: StateType.WARNING,
        message: 'Query Editor is empty. Graph has to be with its query'
      });
      return;
    }

    // Stringify 변환
    let graph_json:string = JSON.stringify( this.resultGraph );
    if( graph_json.length < 5 ){
      this._api.setResponses(<IResponseDto>{
        group: 'project::save',
        state: StateType.WARNING,
        message: 'Graph is empty. Blank graph cannot be saved'
      });
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

      // change Detection by force
      this._cd.detectChanges();
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

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  loadProject(data:IProject){
    // clear
    this.clearProject();
    // editor query
    this.editor.setValue(data.sql);
    let graphData:any = null;

    // json data parse
    try {
      graphData = JSON.parse( data.graph_json );
    } 
    catch(ex) {
      console.log('graph_json parse error =>', ex);
      this._api.setResponses(<IResponseDto>{
        group: 'project::load',
        state: StateType.ERROR,
        message: 'JSON parse error on loading project'
      });
    }

    // load graph
    // ...

    return data;
  }


}
