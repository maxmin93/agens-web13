import { Component, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';

// materials
import { MatDialog, MatSnackBar, MatButtonToggle, MatInput } from '@angular/material';
import { MatTabGroup } from '@angular/material/tabs';

import { DatatableComponent } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';
import { Angulartics2 } from 'angulartics2';

import * as _ from 'lodash';
import { concat, Observable, Subscription, Subject, forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import * as CONFIG from '../../global.config';

import { IResultDto, IResponseDto, IGraphDto } from '../../models/agens-response-types';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IRecord, IColumn, IRow, IEnd } from '../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import { IProject } from '../../models/agens-manager-types';

// Components
import { QueryResultComponent } from './components/query-result/query-result.component';
import { QueryGraphComponent } from './components/query-graph/query-graph.component';
import { QueryTableComponent } from './components/query-table/query-table.component';

// Dialogs
import { SearchResultDialog } from './dialogs/search-result.dialog';
import { ProjectOpenDialog } from './dialogs/project-open-dialog';
import { ProjectSaveDialog } from './dialogs/project-save-dialog';
import { LabelStyleSettingDialog } from './dialogs/label-style-setting.dialog';
import { ImageExportDialog } from './dialogs/image-export.dialog';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { MetaGraphComponent } from './components/meta-graph/meta-graph.component';
import { element } from '../../../../node_modules/protractor';

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
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  query:string =
`match path=(c:customer)-[]->(:"order")-[]->(p:product)-[]-(t:category)
where c.id in ['CENTC','NORTS','SPECD','GROSR','THEBI','FRANR'] and t.id in [4,8,7]
return path;
`;
// `match path=(c:customer)-[]->(o:"order")-[]->(p:product)-[]->()
// return path limit 20;
//  `;


  // core/query API 결과
  private resultDto: IResultDto = undefined;
  private resultGraph: IGraph = undefined;
  private resultRecord: IRecord = undefined;
  private resultMeta: IGraph = undefined;

  // expandTo 를 위한 query API 결과
  private resultExpandDto: IResultDto = undefined;
  private resultExpandGraph: IGraph = undefined;

  // pallets : Node 와 Edge 라벨별 color 셋
  labelColors: any[] = [];
  colorIndex: number = -1;

  initWindowHeight:number = 0;

  currProject: IProject = undefined;
  currentTabIndex: number = -1;

  @ViewChild('queryEditor', {read: ElementRef}) queryEditor: ElementRef;
  @ViewChild('queryResult') queryResult: QueryResultComponent;

  @ViewChild('resultTapGroup') tapGroup: MatTabGroup;

  @ViewChild('metaGraph') metaGraph: MetaGraphComponent;
  @ViewChild('queryGraph') queryGraph: QueryGraphComponent;
  @ViewChild('queryTable') queryTable: QueryTableComponent;
  @ViewChild('statistics') statGraph: StatisticsComponent;

  constructor(    
    private _angulartics2: Angulartics2,
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
      indentWithTabs: false,
      smartIndent: false,
      lineNumbers: true,
      styleActiveLine: true,
      matchBrackets: true,
      autofocus: true,
      theme: 'idea'
    });
    // CodeMirror : initial value
    this.editor.setValue( this.query );
    this.editor.setSize('100%', '60px');

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

  tabChanged($event){
    this.currentTabIndex = $event.index;
  }

  tabAnimationDone(){
    switch( this.currentTabIndex ){
      case 0: 
          this.metaGraph.isVisible = true;
          this.queryGraph.isVisible = false;
          this.statGraph.isVisible = false;
          Promise.resolve(null).then(() => this.metaGraph.refreshCanvas() ); 
          break;
      case -1:
      case 1: 
          this.metaGraph.isVisible = false;
          this.queryGraph.isVisible = true;
          this.statGraph.isVisible = false;
          Promise.resolve(null).then(() => this.queryGraph.refreshCanvas() ); 
          break;
      case 3: 
          this.metaGraph.isVisible = false;
          this.queryGraph.isVisible = false;
          this.statGraph.isVisible = true;
          Promise.resolve(null).then(() => this.statGraph.refreshCanvas() ); 
          break;
    }
  }

  togglePageSize(){

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

    // 에디터 비우고
    this.editor.setValue('');

    // 프로젝트 정보 지우고
    this.currProject = undefined;
  }

  clearResults(){
    this.queryResult.clear();
    this.queryGraph.clear();
    this.queryTable.clear();
    this.metaGraph.clear();
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

  injectMetaElementStyle( ele:IElement ){
    this.resultGraph.labels.map(label => {
      if( label.type == ele.group && label.name == ele.data.label)
        if( !!label.scratch._style ) ele.scratch._style = label.scratch._style;
    });
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // call API: db
  runQuery(){

    this.queryResult.toggleTimer(true);
    this.isLoading = true;

    let sql:string = this.makeupSql(<string> this.editor.getValue());
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
          this.metaGraph.setGid( x.gid );
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
                color: (x.type == 'nodes') ? this._util.nextColor() : undefined };
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
            x.scratch['_styleBak'] = _.clone(label.scratch['_style']);
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
          x.scratch['_styleBak'] = _.clone(label.scratch['_style']);
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
        this.queryGraph.initCanvas();

        // send data to Table 
        this.queryTable.setData(this.resultRecord);

        // // **NOTE: 이어서 schema graph 호출 (gid)
        if( this.resultDto.hasOwnProperty('gid') && this.resultDto.gid > 0 ) 
          this.runGraphSchema( this.resultDto.gid );
      });

  }

  // when button "STOP" click
  stopQuery(){
    this.clearSubscriptions();

    this.isLoading = false;
    this.queryResult.abort();
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
      this.resultMeta.labels.push( x );
      this.metaGraph.addLabel( x );
      this.statGraph.addLabel( x );
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
        });
      this.resultMeta.nodes.push( x );
      this.metaGraph.addNode( x );
      this.statGraph.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.resultGraph.labels
        .filter(val => val.type == 'edges' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
        });
      this.resultMeta.edges.push( x );
      this.metaGraph.addEdge( x );
      this.statGraph.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.queryGraph.graphChangeLayout('cose');
        setTimeout(()=>{
          this._util.calcElementStyles( this.resultMeta.nodes, (x)=>40+x*5, false );
          this._util.calcElementStyles( this.resultMeta.edges, (x)=>2+x, false );
          this._util.applyLabelColor(this.resultMeta.nodes, this.resultGraph.labels, 
            (ele:IElement, label:ILabel) => {
              return label.type == 'nodes' && ele.data['id'] == label.id;
            });
          this._util.applyLabelColor(this.resultMeta.edges, this.resultGraph.labels, 
            (ele:IElement, label:ILabel) => {
              return label.type == 'edges' && ele.data['id'] == label.id;
            });
        
          this.metaGraph.initCanvas();
          this.statGraph.initCanvas();
        }, 100);  
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
        state: CONFIG.StateType.WARNING,
        message: 'Query Editor is empty. Graph has to be with its query'
      });
      return;
    }

    // Stringify 변환
    let graph_json:string = JSON.stringify( this.resultGraph );
    if( graph_json.length < 5 ){
      this._api.setResponses(<IResponseDto>{
        group: 'project::save',
        state: CONFIG.StateType.WARNING,
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
    try {
      graphData = JSON.parse( data.graph_json );
    } 
    catch(ex) {
      console.log('graph_json parse error =>', ex);
      this._api.setResponses(<IResponseDto>{
        group: 'project::load',
        state: CONFIG.StateType.ERROR,
        message: 'JSON parse error on loading project'
      });
    }

    // load graph
    // ...

    return data;
  }


}
