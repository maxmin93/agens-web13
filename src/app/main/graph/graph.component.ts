import { Component, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';

// materials
import { MatDialog, MatSnackBar, MatButtonToggle, MatInput } from '@angular/material';

import { DatatableComponent } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';
import { Angulartics2 } from 'angulartics2';

import * as _ from 'lodash';
import { concat, Observable, Subscription } from 'rxjs';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import * as CONFIG from '../../global.config';

import { IResultDto, IResponseDto } from '../../models/agens-response-types';
import { IGraph, ILabel, INode, IEdge, IStyle, IRecord, IColumn, IRow } from '../../models/agens-data-types';
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

declare var CodeMirror: any;
declare var agens: any;

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements AfterViewInit, OnInit, OnDestroy {

  private subscription: Subscription = undefined;
  public project: any = undefined;

  // controll whether make buttons to able or disable
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  query:string =
`match path=(a:customer)-[]->(b:"order")-[]->(c:product) return path, a, b, c limit 5;
 `;

  // core/query API 결과
  private resultDto: IResultDto = undefined;
  private resultGraph: IGraph = undefined;
  private resultRecord: IRecord = undefined;

  // expandTo 를 위한 query API 결과
  private resultExpandDto: IResultDto = undefined;
  private resultExpandGraph: IGraph = undefined;

  // pallets : Node 와 Edge 라벨별 color 셋
  labelColors: any[] = [];
  colorIndex: number = -1;

  initWindowHeight:number = 0;

  currProject: IProject = undefined;

  @ViewChild('queryEditor', {read: ElementRef}) queryEditor: ElementRef;

  @ViewChild('queryResult') queryResult: QueryResultComponent;
  @ViewChild('queryGraph') queryGraph: QueryGraphComponent;
  @ViewChild('queryTable') queryTable: QueryTableComponent;

  constructor(    
    private _angulartics2: Angulartics2,    
    public dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { }

  ngOnInit(){
  }

  ngOnDestroy(){
    if( this.subscription ) this.subscription.unsubscribe();
  }

  ngAfterViewInit() {
    this._api.changeMenu('graph');

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
    this.editor.setSize('100%', '120px');

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
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  // when button "NEW" click
  clearProject(){
    // 결과값 지우고
    this.resultDto = undefined;
    this.resultGraph = undefined;
    this.resultRecord = undefined;

    // 에디터 비우고
    this.editor.setValue('');

    // 프로젝트 정보 지우고
    this.currProject = undefined;
  }

  clearResults(){
    this.queryResult.clear();
    this.queryGraph.clear();
    this.queryTable.clear();
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

  // call API: db
  runQuery() {

    this.queryResult.toggleTimer(true);
    this.isLoading = true;

    let sql:string = this.makeupSql(<string> this.editor.getValue());
    if( sql.length < 5 ) return;

    // 이전 결과들 비우고
    this.clearResults();

    let result = this._api.getResultSubjects();
    result.info$.subscribe((x:IResultDto) => {
      this.resultDto = <IResultDto>x;
      this.queryResult.setData(<IResponseDto>x);
      // this._angulartics2.eventTrack.next({ action: 'runQuery', properties: { category: 'graph', label: data.message }});
    });

    result.graph$.subscribe((x:IGraph) => {
      this.resultGraph = x;
      this.resultGraph.labels = new Array<ILabel>();
      this.resultGraph.nodes = new Array<INode>();
      this.resultGraph.edges = new Array<IEdge>();
    });
    result.labels$.subscribe((x:ILabel) => {
      x.scratch['_style'] = <IStyle>{ width: undefined, title: undefined
          , color: this.labelColors[ (this.colorIndex++)%CONFIG.MAX_COLOR_SIZE ] };
      this.resultGraph.labels.push( x );
      this.queryGraph.addLabel( x );
    });
    result.nodes$.subscribe((x:INode) => {    
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.resultGraph.labels
        .filter(val => val.type == 'nodes' && val.name == x.data.labels[0])
        .map(label => {
          x.scratch['_neighbors'] += label.neighbors;
          x.scratch['_style'] = label.scratch['_style'];
        });

      this.resultGraph.nodes.push( x );
      this.queryGraph.addNode( x );
    });
    result.edges$.subscribe((x:IEdge) => {
      this.resultGraph.labels
        .filter(val => val.type == 'edges' && val.name == x.data.labels[0])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
        });

      this.resultGraph.edges.push( x );
      this.queryGraph.addEdge( x );
    });

    result.record$.subscribe((x:IRecord) => {
      this.resultRecord = x;
      this.resultRecord.columns = new Array<IColumn>();
      this.resultRecord.rows = new Array<IRow>();
    });
    result.columns$.subscribe((x:IColumn) => {
      this.resultRecord.columns.push( x );
    });
    result.rows$.subscribe((x:IRow) => {
      this.resultRecord.rows.push( x );
    });

    concat( result.info$.asObservable(), result.graph$.asObservable(),
          result.labels$.asObservable(), result.nodes$.asObservable() ) //, result.edges$.asObservable() )
    .subscribe({
      next: data => {
      },
      error: (err) => {
      },
      complete: () => {
        this.isLoading = false;
        // this.queryGraph.labels = [...this.resultGraph.labels];
        this.queryGraph.refresh();
        // this.queryTable.setData( this.resultRecord );
      }
    });

    this.subscription = this._api.core_query( sql );
  }

  // when button "STOP" click
  stopQuery(){
    // query unsubscribe
    if( this.subscription ){
      this.subscription.unsubscribe();
    }
    this.isLoading = false;
    this.queryResult.abort();
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
