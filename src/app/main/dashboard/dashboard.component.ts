import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, of, from, Subject, Subscription, concat, forkJoin } from 'rxjs';
import { map, filter, concatAll } from 'rxjs/operators';

import * as _ from 'lodash';

// ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
import { DatatableComponent } from '@swimlane/ngx-datatable';
// dialogs
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ConfirmDeleteLabelDialog } from './dialogs/confirm-delete-label.dialog';
import { InputCreateLabelDialog } from './dialogs/input-create-label.dialog';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IEnd } from '../../models/agens-data-types'
import { IResponseDto } from '../../models/agens-response-types';
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import * as CONFIG from '../../app.config';
import { ISchemaDto } from '../../models/agens-response-types';

import * as d3 from 'd3';

declare var $: any;
declare var agens: any;

const EMPTY_LABEL: ILabel = { 
  group: 'labels', id: '', type: '', name: '', owner: '', desc: '', size: 0
  , properties: [], sources: [], targets: [], scratch: { size_not_empty: 0, is_dirty: true }
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {

  // cytoscape 객체
  private cy:any = null;
  
  // call API
  handlers:Subscription[] = [undefined, undefined, undefined, undefined, undefined, undefined];
  datasource: IDatasource = undefined;
  graph: IGraph;
  labels: Array<ILabel>;

  // 화면 출력
  infos: any = {
    uri: '', name: '', owner: '', desc: ''
    , nodes_size_total: 0, edges_size_total: 0, nodes_size_data: 0, edges_size_data: 0 
  };

  // 선택 label
  selectedLabels: Array<ILabel> = new Array<ILabel>();
  selectedLabel: ILabel = EMPTY_LABEL;
  deletedLabel: ILabel = null;  // from ConfirmDeleteLabelDialog
  createdLabel: ILabel = null;  // from CreateLabelInputDialog

  // 출력: 테이블 labels
  tableLabelsRows: Array<ILabel> = new Array<ILabel>();
  tableLabelsColumns: Array<any> = [
    { name: 'TYPE', prop: 'type' },
    { name: 'ID', prop: 'id' },
    { name: 'NAME', prop: 'name' },
    { name: 'SIZE', prop: 'size' },
  ];

  // 출력: 테이블 label의 properties
  tablePropertiesRows: Array<IProperty> = new Array<IProperty>();
  tablePropertiesColumns : Array<any> = [
    { name: 'KEY', prop: 'key' },
    { name: 'TYPE', prop: 'type' }
  ];
  
  // ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
  @ViewChild('tableLabels') tableLabels: DatatableComponent;
  // @ViewChild('tableProperties') tableProperties: DatatableComponent;
    
  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _router: Router,
    public dialog: MatDialog,
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
  }

  ngOnInit(){
    this._api.changeMenu('main');

    // Cytoscape 생성 & 초기화
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'multiple'
        boxSelectionEnabled: false, // if single then false, else true
        userCxtmenu: true,          // whether to use Context menu or not
        hideNodeTitle: false,       // hide nodes' title
        hideEdgeTitle: false,       // hide edges' title
    });
  }

  ngOnDestroy(){
    this.clearSubscriptions();
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);
      // change Detection by force
      this._cd.detectChanges();
    });
    Promise.resolve(null).then(() => {
      this.cy.$api.qtipFn = this.cyQtipMenuCallback;
    });

    // Cytoscape 바탕화면 qTip menu
    let tooltip = this.cy.qtip({
      content: function(e){ 
        console.log( 'qtip.content:', e );
        let html:string = `<div class="hide-me"><h4><strong>Menu</strong></h4><hr/><ul>`;
        html += `<li><a href="javascript:void(0)" onclick="agens.cy.$api.qtipFn('addNode','all')")>create new NODE</a></li>`;
        html += `</ul></div>`;
        return html;
      },
      show: { event: 'cxttap', cyBgOnly: true },    // cxttap: mouse right button click event
      hide: { event: 'click unfocus' },
      position: { target: 'mouse', adjust: { mouse: false } },
      style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
      events: { visible: (event, api) => { $('.qtip').click(() => { $('.qtip').hide(); }); }}
    });

    // schemaData
    this.callCoreSchema();

    // qTip
  }

  qtipMenuClick(){
    console.log('qtipMenuClick!!', this.cy._private.container);

  }

  /////////////////////////////////////////////////////////////////
  // Common Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    this.cy.elements(':selected').unselect();
    this.selectFromGraph(target.id());
  }

  // Qtip 메뉴 선택 콜백 함수
  cyQtipMenuCallback(target:any, value:any):void {
    console.log( 'cyQtipMenuCallback:', target, value);
  }

  //////////////////////////////////////////////

  toggleProgress(option:boolean=undefined){
    if( option === undefined ){
      this.progressBar.nativeElement.style.visibility = 
        (this.progressBar.nativeElement.style.visibility == 'visible') ? 'hidden' : 'visible';
    }
    else{
      this.progressBar.nativeElement.style.visibility = option ? 'visible' : 'hidden';
    }
  }

  clearInfos(){
    this.infos = <any>{
      uri: '', name: '', owner: '', desc: ''
      , nodes_size_total: 0, edges_size_total: 0, nodes_size_data: 0, edges_size_data: 0 
    };
  }

  clearCanvas(){
    if( this.cy ) this.cy.elements().remove();
  }

  clearSubscriptions(){
    this.handlers.forEach(x => { 
      if(x) x.unsubscribe(); 
      x = undefined; 
    });
  }

  clearTables(){
    this.selectedLabels = <ILabel[]>[];
    this.selectedLabel = EMPTY_LABEL;
    this.deletedLabel = <ILabel>null;
    this.createdLabel = <ILabel>null;
  
    this.tableLabelsRows = new Array<ILabel>();
    this.tablePropertiesRows = new Array<IProperty>();  
  }

  initCanvas(){
    // if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    // this.cy.elements(':selected').unselect();
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.$api.changeLayout('klay');
  }
  refreshCanvas(){
    this.cy.resize();
    this.cy.fit( this.cy.elements(), 50);
  }

  //////////////////////////////////////////////

  callCoreSchema(){

    this.toggleProgress(true);
    
    // call API
    let data$:Observable<any> = this._api.core_schema();
    
    this.handlers[0] = data$.pipe( filter(x => x['group'] == 'schema') ).subscribe(
      (x:ISchemaDto) => {
        this.datasource = x.datasource;
        this.labels = x.labels;
      },
      err => {
        console.log( 'core.schema: ERROR=', err instanceof HttpErrorResponse, err.error );
        this._api.setResponses(<IResponseDto>{
          group: 'core.schema',
          state: err.statusText,
          message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
        });
        
        this.clearSubscriptions();
        setTimeout(()=>{
          this._router.navigate(['/login'], { queryParams: { returnUrl: '/' }});
        },30);
      });
    this.handlers[1] = data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.graph = x;
        this.graph.labels = new Array<ILabel>();
        this.graph.nodes = new Array<INode>();
        this.graph.edges = new Array<IEdge>();
      });
    this.handlers[2] = data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => {
        this.graph.labels.push(x);
      });
    this.handlers[3] = data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        this.graph.nodes.push(x);
        this.cy.add(x);
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.graph.edges.push(x);
        this.cy.add(x);
      });
    this.handlers[5] = data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.showGraph();
        // 화면 출력 : ngAfterViewInit emitter 이후 실행
        Promise.resolve(null).then(() => {
          this.showDatasource();
          this.showTable();
        });         
        this.toggleProgress(false);
      });
  }

  showDatasource(){
    this.infos = {
      uri: this.datasource.jdbc_url, name: this.datasource.name, owner: this.datasource.owner, desc: this.datasource.desc
      , nodes_size_total: this.labels.filter(x => x.type == 'nodes').length
      , edges_size_total: this.labels.filter(x => x.type == 'edges').length
      , nodes_size_data:  this.labels.filter(x => x.type == 'nodes' && x.size > 0).length
      , edges_size_data:  this.labels.filter(x => x.type == 'edges' && x.size > 0).length
    };
  }

  showTable(){
    this.tableLabelsRows = [...this.labels];

    // graph에 select 처리
    if( this.labels.length > 0 ){
      this.selectedLabel = this.tableLabelsRows[0];
      this.selectFromTable(this.selectedLabel);
    }    
  }

  showGraph(){
    this._util.calcElementStyles( this.graph.nodes, (x)=>40+x*5 );
    this._util.calcElementStyles( this.graph.edges, (x)=>2+x );
    this.cy.style(agens.graph.stylelist['dark']).update();
    // this.cy.$api.changeLayout('klay');    
    this.changeLayout( this.cy.elements() );
  }

  changeLayout( elements ){
    let options = { name: 'klay',
      nodeDimensionsIncludeLabels: false, fit: true, padding: 50,
      animate: false, transform: function( node, pos ){ return pos; },
      ready: undefined, stop: undefined, 
      klay: {
        // Following descriptions taken from http://layout.rtsys.informatik.uni-kiel.de:9444/Providedlayout.html?algorithm=de.cau.cs.kieler.klay.layered
        addUnnecessaryBendpoints: false, // Adds bend points even if an edge does not change direction.
        aspectRatio: 1.6, // The aimed aspect ratio of the drawing, that is the quotient of width by height
        borderSpacing: 50, // Minimal amount of space to be left to the border
        compactComponents: false, // Tries to further compact components (disconnected sub-graphs).
        crossingMinimization: 'LAYER_SWEEP', // Strategy for crossing minimization.
        /* LAYER_SWEEP The layer sweep algorithm iterates multiple times over the layers, trying to find node orderings that minimize the number of crossings. The algorithm uses randomization to increase the odds of finding a good result. To improve its results, consider increasing the Thoroughness option, which influences the number of iterations done. The Randomization seed also influences results.
        INTERACTIVE Orders the nodes of each layer by comparing their positions before the layout algorithm was started. The idea is that the relative order of nodes as it was before layout was applied is not changed. This of course requires valid positions for all nodes to have been set on the input graph before calling the layout algorithm. The interactive layer sweep algorithm uses the Interactive Reference Point option to determine which reference point of nodes are used to compare positions. */
        cycleBreaking: 'GREEDY', // Strategy for cycle breaking. Cycle breaking looks for cycles in the graph and determines which edges to reverse to break the cycles. Reversed edges will end up pointing to the opposite direction of regular edges (that is, reversed edges will point left if edges usually point right).
        /* GREEDY This algorithm reverses edges greedily. The algorithm tries to avoid edges that have the Priority property set.
        INTERACTIVE The interactive algorithm tries to reverse edges that already pointed leftwards in the input graph. This requires node and port coordinates to have been set to sensible values.*/
        direction: 'UNDEFINED', // Overall direction of edges: horizontal (right / left) or vertical (down / up)
        /* UNDEFINED, RIGHT, LEFT, DOWN, UP */
        edgeRouting: 'ORTHOGONAL', // Defines how edges are routed (POLYLINE, ORTHOGONAL, SPLINES)
        edgeSpacingFactor: 0.6, // Factor by which the object spacing is multiplied to arrive at the minimal spacing between edges.
        feedbackEdges: false, // Whether feedback edges should be highlighted by routing around the nodes.
        fixedAlignment: 'NONE', // Tells the BK node placer to use a certain alignment instead of taking the optimal result.  This option should usually be left alone.
        /* NONE Chooses the smallest layout from the four possible candidates.
        LEFTUP Chooses the left-up candidate from the four possible candidates.
        RIGHTUP Chooses the right-up candidate from the four possible candidates.
        LEFTDOWN Chooses the left-down candidate from the four possible candidates.
        RIGHTDOWN Chooses the right-down candidate from the four possible candidates.
        BALANCED Creates a balanced layout from the four possible candidates. */
        inLayerSpacingFactor: 1.0, // Factor by which the usual spacing is multiplied to determine the in-layer spacing between objects.
        layoutHierarchy: false, // Whether the selected layouter should consider the full hierarchy
        linearSegmentsDeflectionDampening: 0.3, // Dampens the movement of nodes to keep the diagram from getting too large.
        mergeEdges: false, // Edges that have no ports are merged so they touch the connected nodes at the same points.
        mergeHierarchyCrossingEdges: true, // If hierarchical layout is active, hierarchy-crossing edges use as few hierarchical ports as possible.
        nodeLayering:'NETWORK_SIMPLEX', // Strategy for node layering.
        /* NETWORK_SIMPLEX This algorithm tries to minimize the length of edges. This is the most computationally intensive algorithm. The number of iterations after which it aborts if it hasn't found a result yet can be set with the Maximal Iterations option.
        LONGEST_PATH A very simple algorithm that distributes nodes along their longest path to a sink node.
        INTERACTIVE Distributes the nodes into layers by comparing their positions before the layout algorithm was started. The idea is that the relative horizontal order of nodes as it was before layout was applied is not changed. This of course requires valid positions for all nodes to have been set on the input graph before calling the layout algorithm. The interactive node layering algorithm uses the Interactive Reference Point option to determine which reference point of nodes are used to compare positions. */
        nodePlacement:'BRANDES_KOEPF', // Strategy for Node Placement
        /* BRANDES_KOEPF Minimizes the number of edge bends at the expense of diagram size: diagrams drawn with this algorithm are usually higher than diagrams drawn with other algorithms.
        LINEAR_SEGMENTS Computes a balanced placement.
        INTERACTIVE Tries to keep the preset y coordinates of nodes from the original layout. For dummy nodes, a guess is made to infer their coordinates. Requires the other interactive phase implementations to have run as well.
        SIMPLE Minimizes the area at the expense of... well, pretty much everything else. */
        randomizationSeed: 1, // Seed used for pseudo-random number generators to control the layout algorithm; 0 means a new seed is generated
        routeSelfLoopInside: false, // Whether a self-loop is routed around or inside its node.
        separateConnectedComponents: true, // Whether each connected component should be processed separately
        spacing: 50, // Overall setting for the minimal amount of space to be left between objects
        thoroughness: 7 // How much effort should be spent to produce a nice layout..
      },
      priority: function( edge ){ return null; }, // Edges with a non-nil value are skipped when geedy edge cycle breaking is enabled
    };    

    // adjust layout
    let layoutHandler = elements.layout(options);
    layoutHandler.run();
  }

  ////////////////////////////////////////////////////////

  // 클릭된 element 해당하는 label 정보를 화면에 연결하기
  selectFromGraph(id:string):ILabel {
    // console.log( 'clicked id=', id.valueOf());
    for( let label of this.tableLabelsRows ){
      if( label.id === id ) {
        this.selectedLabel = label;         // 라벨 정보창으로
        this.tablePropertiesRows = label.properties;  // 라벨 속성 테이블로

        // this._angulartics2.eventTrack.next({ action: 'graphSelect', properties: { category: 'main', label: label.type+'.'+label.name }});
        return label;
      }
    }
    return EMPTY_LABEL;
  }

  // 테이블에서 선택된 row 에 해당하는 graph element 선택 연동
  selectFromTable(target:ILabel) {
    if( target === null ) return;
    // 기존꺼 unselect
    if( this.cy.$api.view !== undefined ) this.cy.$api.view.removeHighlights();
    this.cy.elements(':selected').unselect();
    // 선택한거 select
    this.cy.elements().getElementById(target.id).select();

    // 선택한거 테이블 내용 갱신
    this.selectedLabel = target;
    this.tablePropertiesRows = target.properties;

    // this._angulartics2.eventTrack.next({ action: 'tableSelect', properties: { category: 'main', label: target.type+'.'+target.name}});
  }

  onSelectTableLabels({ selected }){
    this.selectFromTable(<ILabel> selected[0] );
  }

  /////////////////////////////////////////////////////////////////
  // Drop Label Controllers
  /////////////////////////////////////////////////////////////////

  // confirm delete dialog: open
  openConfirmDeleteLabelDialog(label:ILabel) {
    let dialogRef = this.dialog.open(ConfirmDeleteLabelDialog, {
      width: '400px',
      data: label
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('ConfirmDeleteLabelDialog was closed:', result);
      if( result === null ) return;
      // DROP label 위한 API 호출
      this._api.core_command_drop_label(result).subscribe(
        dto => {
          this._api.setResponses(<IResponseDto>dto);
          if( dto.state == CONFIG.StateType.SUCCESS ) this.deleteLabelUpdate(dto.label);
        },
        err => {
          console.log( 'schema.deleteLabel: ERROR=', err instanceof HttpErrorResponse, err.error );
          this._api.setResponses(<IResponseDto>{
            group: 'schema.deleteLabel',
            state: err.statusText,
            message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
          });
        }
      );
    });
  }

  deleteLabelUpdate(target:ILabel){
    this.deletedLabel = target;
    console.log('deleteLabelUpdate:', target);

    // canvas 에서 삭제
    this.cy.elements().getElementById(target.id).remove();
    // table 에서 삭제하고 refresh
    let idx = this.labels.findIndex(ele => ele.id == target.id);
    if( idx >= 0 ){
      this.labels.splice(idx, 1);
      this.tableLabelsRows = [...this.labels];  //_.clone(this.labels);
      // label 개수 감소
      if( target.type == 'nodes' ) this.infos['nodes_size_total'] -= 1;
      else this.infos['edges_size_total'] -= 1;
    }

    this.tablePropertiesRows = [];
    this.selectedLabel = EMPTY_LABEL;
  }

  /////////////////////////////////////////////////////////////////
  // Create Label Controllers
  /////////////////////////////////////////////////////////////////

  openInputCreateLabelDialog(): void {
    let dialogRef = this.dialog.open( InputCreateLabelDialog, {
      width: '400px',
      data: this.tableLabelsRows
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('CreateLabelInputDialog was closed:', result );
      if( result === null ) return;

      // CREATE label 위한 API 호출
      this._api.core_command_create_label(result).subscribe(
        dto => {
          this._api.setResponses(<IResponseDto>dto);
          if( dto.state == CONFIG.StateType.SUCCESS ) this.createLabelUpdate(dto.label);
        },
        err => {
          console.log( 'schema.createLabel: ERROR=', err instanceof HttpErrorResponse, err.error );
          this._api.setResponses(<IResponseDto>{
            group: 'schema.createLabel',
            state: err.statusText,
            message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
          });
        }
      );
    });
  }

  createLabelUpdate(target:ILabel){
    this.createdLabel = target;
    console.log('createLabelUpdate:', target);

    // table에 추가하고 refresh    
    this.selectedLabel = target;
    this.labels.push(<ILabel>target);
    this.tableLabelsRows = [...this.labels];
    
    // graph에 추가 (node이면 그냥 추가, but edge는 추가 안함)
    if( target.type === 'nodes' ){
      if( this.cy.$api.view !== undefined ) this.cy.$api.view.removeHighlights();
      this.cy.elements(':selected').unselect();
      this.cy.center();
      let ele = this.cy.add({
        group: 'nodes',
        schema: { id: target.id, labels: ['NODE'], name: target.name, size: 0, props: target.properties },
        selectable: true, selected: true
      });
      // nodes 개수 증가
      this.infos['nodes_size_total'] += 1;
    }
    else{
      // edges 개수 증가
      this.infos['edges_size_total'] += 1;
    }
  }

}
