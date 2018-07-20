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
import { IGraph, ILabel, INode, IEdge, IRecord, IColumn, IRow } from '../../models/agens-data-types';
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

declare var $: any;
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

  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  query:string =
`
 `;

  // core/query API 결과
  private resultDto: IResultDto = undefined;
  private resultGraph: IGraph = undefined;
  private resultRecord: IRecord = undefined;

  // expandTo 를 위한 query API 결과
  private resultExpandDto: IResultDto = undefined;
  private resultExpandGraph: IGraph = undefined;

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
      if( e.keyCode == 13 ) this.cy.resize();
    });

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
  runQuery( callback:()=>void = undefined ){

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
      this.resultGraph.labels.push( x );
    });
    result.nodes$.subscribe((x:INode) => {
      this.resultGraph.nodes.push( x );
      this.queryGraph.addNode( x );
    });
    result.edges$.subscribe((x:IEdge) => {
      this.resultGraph.edges.push( x );
      this.queryGraph.addEdge( x );
    });
    result.record$.subscribe((x:IRecord) => {
      this.resultRecord = x;
      this.resultRecord.columns = new Array<IColumn>();
      this.resultRecord.rows = new Array<IRow>();
    });
    result.colmuns$.subscribe((x:IColumn) => {
      this.resultRecord.columns.push( x );
    });
    result.rows$.subscribe((x:IRow) => {
      this.resultRecord.rows.push( x );
    });

    concat( result.info$.asObservable(), result.graph$.asObservable(),
          result.labels$.asObservable(), result.nodes$.asObservable(), result.edges$.asObservable() )
    .subscribe({
      next: data => {
      },
      error: (err) => {
      },
      complete: () => {
        this.queryGraph.refresh();
        this.queryTable.setData( this.resultRecord );
      }
    });

    this.subscription = this._api.core_query( sql );
  }

  // when button "STOP" click
  stopQuery(){
    // query unsubscribe
    if( this.subscription ) this.subscription.unsubscribe();

    this.queryResult.abort();
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

    // graph 데이터에 Label용 meta 항목 추가 : this.graphLabels
    let graphData = this.cy.json();   // elements, 등등..
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
        this.adjustMenuOnNode( this.graphLabels, this.cy.nodes() );
      }
    }
    return data;
  }


}
