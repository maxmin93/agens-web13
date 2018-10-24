import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, empty, interval, Subscription, concat } from 'rxjs';
import { map, filter, concatAll, tap } from 'rxjs/operators';

import * as _ from 'lodash';

// ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
import { DatatableComponent } from '@swimlane/ngx-datatable';
// dialogs
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { ConfirmDeleteLabelDialog } from './dialogs/confirm-delete-label.dialog';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IEnd } from '../../models/agens-data-types'
import { IResponseDto, ILabelDto } from '../../models/agens-response-types';

import * as CONFIG from '../../app.config';
import { ISchemaDto } from '../../models/agens-response-types';

declare var $: any;
declare var agens: any;

const EMPTY_LABEL: ILabel = { 
  group: 'labels', id: '', type: '', name: '', owner: '', desc: '', size: 0
  , properties: [], sources: [], targets: [], scratch: { is_dirty: true }
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {

  // cytoscape 객체
  private cy:any = null;
  private cyDoubleClickDelayMs = 350;
  private cyPreviousTapStamp;

  // 선택 버튼: edge, delete
  btnStatus:any = { edit: false, delete: false, save: false };
  private counterNew:number = 0;

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
  tableLabelsRows: ILabel[] = [];
  tableLabelsColumns: any[] = [
    { name: 'Type', prop: 'type' },
    { name: 'ID', prop: 'id' },
    { name: 'Name', prop: 'name' },
    { name: 'Size', prop: 'size' },
    { name: 'Volume', prop: 'volume' },
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
  @ViewChild('labelNameCtl', {read: ElementRef}) labelNameCtl: ElementRef;
  @ViewChild('labelDescCtl', {read: ElementRef}) labelDescCtl: ElementRef;

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
    agens.cy = this.cy;

    this.divCanvas.nativeElement.style.cursor = 'pointer';   // Finger
  }

  ngOnDestroy(){
    this.clearSubscriptions();
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback(e);
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);
      // change Detection by force
      this._cd.detectChanges();
    });

    // only canvas trigger doubleTap event
    this.cy.on('doubleTap', (e, originalTapEvent) => {
      if( this.btnStatus.edit ){
        if( originalTapEvent.position ) this.createNode( originalTapEvent.position );
      }
    });

    // edge 생성 이벤트
    this.cy.on('ehcomplete', (event, sourceNode, targetNode, addedEles) => {
      let { position } = event;
      this.cy.elements(':selected').unselect();      
      
      let edge:any = addedEles.nonempty() ? addedEles.first() : undefined;
      let sourceV = edge ? edge.source(): undefined;
      let targetV = edge ? edge.target(): undefined;
      this.cy.remove( addedEles );      // remove oldEdge having temporary id

      this.handlers[4] = this.createLabelOnDB('edges').subscribe(          
        x => {
          // **NOTE: edge의 id를 변경하면 rendering error 발생!!
          // ==> 새로운 edge를 생성하고, addedEdge는 삭제
          //     edge._private.data['id'] = x.label.id;   // cy error

          if( sourceV && targetV ){
            let newE = this.cy.add({    // add newEdge having right id from DB
              group: 'edges',
              data: {
                id: x.label.id,
                label: x.label.type,
                name: x.label.name,
                size: x.label.size,
                source: sourceV.id(),
                target: targetV.id(),
                props: {
                  id: x.label.id,
                  name: x.label.name,
                  owner: x.label.owner,
                  is_dirty: true,
                  desc: x.label.desc,
                  size: x.label.size                  
                }
              },
              scratch: { _style: { color: undefined, width: '2px', title: 'name' }},
              classes: 'new'
            });
            newE.style('label', edge._private.data['name']);
            newE.select();
          }
          // table에 추가하고 refresh
          this.btnStatus.save = false;
          this.selectedLabel = x.label;
          this.labelNameCtl.nativeElement.focus();      // setFocus

          this.labels.push(<ILabel>x.label);
          this.tableLabelsRows = [...this.labels];  
          this._cd.detectChanges();
        },
        err => {
          console.log('ERROR createEdge:', err, edge);
        }
      );
    });

    Promise.resolve(null).then(() => {
      this.cy.$api.qtipFn = this.cyQtipMenuCallback;
    });
/*
    // Cytoscape 바탕화면 qTip menu
    let tooltip = this.cy.qtip({
      content: function(e){ 
        let html:string = `<div class="hide-me"><h4><strong>Menu</strong></h4><hr/><ul>`;
        html += `<li><a href="javascript:void(0)" onclick="agens.cy.$api.qtipFn('newNode')")>create new NODE</a></li>`;
        html += `</ul></div>`;
        return html;
      },
      show: { event: 'cxttap', cyBgOnly: true },    // cxttap: mouse right button click event
      hide: { event: 'click unfocus' },
      position: { target: 'mouse', adjust: { mouse: false } },
      style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
      events: { visible: (event, api) => { $('.qtip').click(() => { $('.qtip').hide(); }); }}
    });
*/
    // schemaData
    this.callCoreSchema();
  }

  /////////////////////////////////////////////////////////////////
  // Common Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback(e):void {

    let currentTapStamp = e.timeStamp;
    let msFromLastTap = currentTapStamp - this.cyPreviousTapStamp;

    if (msFromLastTap < this.cyDoubleClickDelayMs) {
        e.target.trigger('doubleTap', e);
    }
    this.cyPreviousTapStamp = currentTapStamp;
    
    // delete 모드인 경우 해제
    if( this.btnStatus.delete ){
      this.toggleDeleteElement(false);
    }
    this.cy.elements(':selected').unselect();
    this.selectedLabel = undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    this.cy.elements(':selected').unselect();
    
    // delete 모드인 경우 confirmDeleteLabel 다이얼로그 띄우기
    if( this.btnStatus.delete ){
      let temp = this.labels.filter(x => x.id == target.id() && x.type == target.group());
      if( temp.length > 0 ) this.openConfirmDeleteLabelDialog(temp[0]);
    }
    else this.selectFromGraph(target.id());
  }

  // Qtip 메뉴 선택 콜백 함수
  cyQtipMenuCallback(value:any):void {
    console.log( 'cyQtipMenuCallback:', value, agens.cy.scratch('_position') );
    // this.createNode();
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
    this._cd.detectChanges();
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

    this.btnStatus = { edge: false, delete: false, save: false };
    this.divCanvas.nativeElement.style.cursor = 'pointer';   // Finger
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
    this.selectedLabel = undefined;

    // graph에 select 처리
    if( this.labels.length > 0 ){
      // this.selectedLabel = this.tableLabelsRows[0];
      // this.tableLabels.selected = [ this.tableLabelsRows[0] ];
      // this.selectFromTable(this.selectedLabel);
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
    /*
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
        cycleBreaking: 'GREEDY', // Strategy for cycle breaking. Cycle breaking looks for cycles in the graph and determines which edges to reverse to break the cycles. Reversed edges will end up pointing to the opposite direction of regular edges (that is, reversed edges will point left if edges usually point right).
        direction: 'UNDEFINED', // Overall direction of edges: horizontal (right / left) or vertical (down / up)
        edgeRouting: 'ORTHOGONAL', // Defines how edges are routed (POLYLINE, ORTHOGONAL, SPLINES)
        edgeSpacingFactor: 0.6, // Factor by which the object spacing is multiplied to arrive at the minimal spacing between edges.
        feedbackEdges: false, // Whether feedback edges should be highlighted by routing around the nodes.
        fixedAlignment: 'NONE', // Tells the BK node placer to use a certain alignment instead of taking the optimal result.  This option should usually be left alone.
        inLayerSpacingFactor: 1.0, // Factor by which the usual spacing is multiplied to determine the in-layer spacing between objects.
        layoutHierarchy: false, // Whether the selected layouter should consider the full hierarchy
        linearSegmentsDeflectionDampening: 0.3, // Dampens the movement of nodes to keep the diagram from getting too large.
        mergeEdges: false, // Edges that have no ports are merged so they touch the connected nodes at the same points.
        mergeHierarchyCrossingEdges: true, // If hierarchical layout is active, hierarchy-crossing edges use as few hierarchical ports as possible.
        nodeLayering:'NETWORK_SIMPLEX', // Strategy for node layering.
        nodePlacement:'BRANDES_KOEPF', // Strategy for Node Placement
        randomizationSeed: 1, // Seed used for pseudo-random number generators to control the layout algorithm; 0 means a new seed is generated
        routeSelfLoopInside: false, // Whether a self-loop is routed around or inside its node.
        separateConnectedComponents: true, // Whether each connected component should be processed separately
        spacing: 50, // Overall setting for the minimal amount of space to be left between objects
        thoroughness: 7 // How much effort should be spent to produce a nice layout..
      },
      priority: function( edge ){ return null; }, // Edges with a non-nil value are skipped when geedy edge cycle breaking is enabled
    };    
    */

    let options = { name: 'dagre',
      // dagre algo options, uses default value on undefined
      nodeSep: undefined, // the separation between adjacent nodes in the same rank
      edgeSep: undefined, // the separation between adjacent edges in the same rank
      rankSep: undefined, // the separation between adjacent nodes in the same rank
      rankDir: undefined, // 'TB' for top to bottom flow, 'LR' for left to right,
      ranker: undefined, // Type of algorithm to assign a rank to each node in the input graph. Possible values: 'network-simplex', 'tight-tree' or 'longest-path'
      minLen: function( e ){ return 1.5; }, // number of ranks to keep between the source and target of the edge
      edgeWeight: function( e ){ return Math.floor( Math.log10(e.data('size')+1)*10 )/10; }, // higher weight edges are generally made shorter and straighter than lower weight edges
    
      // general layout options
      fit: true, // whether to fit to viewport
      padding: 30, // fit padding
      spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
      nodeDimensionsIncludeLabels: false, // whether labels should be included in determining the space used by a node
      animate: false, // whether to transition the node positions
      animateFilter: function( node, i ){ return true; }, // whether to animate specific nodes when animation is on; non-animated nodes immediately go to their final positions
      animationDuration: 500, // duration of animation in ms if enabled
      animationEasing: undefined, // easing of animation if enabled
      boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
      transform: function( node, pos ){ return pos; }, // a function that applies a transform to the final node position
      ready: function(){}, // on layoutready
      stop: function(){} // on layoutstop
    };

    // adjust layout
    let layoutHandler = elements.layout(options);
    layoutHandler.run();
  }

  ////////////////////////////////////////////////////////

  changeLabelValues(event){
    if( this.selectedLabel ) this.btnStatus.save = true;
  }

  // 클릭된 element 해당하는 label 정보를 화면에 연결하기
  selectFromGraph(id:string):ILabel {
    // console.log( 'clicked id=', id.valueOf());
    let index:number = -1;
    for( let label of this.tableLabelsRows ){
      index += 1;
      if( label.id === id ) {
        // 다른 라벨 선택시 btnStatus.save 비활성화
        if( !this.selectedLabel || label.id !== this.selectedLabel.id ){
          this.btnStatus.save = false;
          this.tableLabels.offset = Math.floor( index / this.tableLabels.limit );
          this.tableLabels.selected = [ label ];

          this.selectedLabel = label;                   // 라벨 정보창으로
          this.tablePropertiesRows = label.properties;  // 라벨 속성 테이블로
          this.labelNameCtl.nativeElement.focus();      // setFocus
          this._cd.detectChanges();
        } 

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
    this.selectedLabel = undefined;   // EMPTY_LABEL;
  }

  /////////////////////////////////////////////////////////////////
  // Create Label Controllers
  /////////////////////////////////////////////////////////////////

  createLabelOnDB(type:string):Observable<ILabelDto> {
    let newName:string = 'new_label_'+(++this.counterNew);
    while( this.labels.filter(x => x.name == newName).length > 0 ){
      newName = 'new_label_'+(++this.counterNew);
    }
    return this._api.core_create_label(type, newName);
  }

  ////////////////////////////////////////////////////////
  // 유용한 커서 타입: 'context-menu', 'move', 'copy', 'wait', 'zoom-in', 'zoom-out'

  createNode(position:any=undefined){
    this.cy.elements(':selected').unselect();

    this.handlers[4] = this.createLabelOnDB('nodes').subscribe(
      (x:ILabelDto) => {
        let boundingBox = this.cy.elements().boundingBox();
        position = position ? position : {
          x: Math.floor(Math.random() * (boundingBox.x2 - boundingBox.x1 + 1)) + boundingBox.x1,
          y: Math.floor(Math.random() * (boundingBox.y2 - boundingBox.y1 + 1)) + boundingBox.y1,
        }
        let ele = this.cy.add( {
          group: 'nodes',
          data: {
            id: x.label.id,
            label: x.label.type,
            size: x.label.size,
            props: { name: x.label.name }
          },
          scratch: { _style: { color: this._util.nextColor(), width: '40px', title: 'name' }},
          position: position,
          classes: 'new'
        });
        ele.style('label', ele.data('props')['name']);
        ele.select();

        // table에 추가하고 refresh
        this.btnStatus.save = false;
        this.selectedLabel = x.label;
        this.labelNameCtl.nativeElement.focus();      // setFocus

        this.labels.push(<ILabel>x.label);
        this.tableLabelsRows = [...this.labels];
        this._cd.detectChanges();
      },
      err => {
        console.log('ERROR createNode:', err);
      }      
    );
  }

  toggleEditEdge(option:boolean=undefined){
    if( option ) this.btnStatus.edit = option;
    else this.btnStatus.edit = !this.btnStatus.edit;

    if( this.btnStatus.edit ){
      this.btnStatus.delete = false;
      this.cy.$api.edge.enable();
      // this.cy.$api.edge.enableDrawMode();
      this.divCanvas.nativeElement.style.cursor = 'cell';     // PLUS
    }else{
      this.cy.$api.edge.disable();
      this.divCanvas.nativeElement.style.cursor = 'pointer';  // Default

      Promise.resolve(null).then(()=>{
        this.cy.nodes('.eh-handle').removeClass('eh-handle');
      });
    }
  }

  toggleDeleteElement(option:boolean=undefined){
    if( option ) this.btnStatus.delete = option;
    else this.btnStatus.delete = !this.btnStatus.delete;

    if( this.btnStatus.delete ){
      this.btnStatus.edit = false;
      this.divCanvas.nativeElement.style.cursor = 'not-allowed';   // or no-drop
    }else{
      this.divCanvas.nativeElement.style.cursor = 'pointer';  // Default
    }
  }

  // update LABEL info. (alter label)
  saveElement(){
    let name$:Observable<ILabelDto> = empty();
    let desc$:Observable<ILabelDto> = empty();

    // update Desc : comment on label
    if( this.labelDescCtl.nativeElement.value != ''
        && this.selectedLabel.desc != this.labelDescCtl.nativeElement.value ){
      console.log( 'update desc:', this.labelDescCtl.nativeElement.value);
      desc$ = this._api.core_comment_label(this.selectedLabel.type, 
                    this.selectedLabel.name, this.labelDescCtl.nativeElement.value);
    }
    
    // update Name : alter label rename
    if( this.labelNameCtl.nativeElement.value != ''
        && this.selectedLabel.name != this.labelNameCtl.nativeElement.value ){
      console.log( 'update name:', this.labelNameCtl.nativeElement.value);
      name$ = this._api.core_rename_label(this.selectedLabel.type, 
        this.selectedLabel.name, this.labelNameCtl.nativeElement.value);
    }
    
    // **NOTE: empty 일 경우에는 subscribe 되지 않는다 (필터링 필요없음)
    concat( desc$, name$ ).pipe(tap(x => console.log)).subscribe( 
      x => {
      console.log( 'saveElement:', x.request.type, x );
      if( !x.label ) return;
      let targetsRow = this.tableLabelsRows.filter(y => y.id == x.label.id && y.type == x.label.type );
      let targetsEle = this.cy.getElementById(x.label.id);
      // update information
      if( x.request && x.request.type )
        switch( x.request.type ){
          case CONFIG.RequestType.COMMENT:
              targetsRow.forEach(y => { y.desc = x.label.desc; });
              targetsEle.forEach(y => { y._private.data['props']['desc'] = x.label.desc; });
              break;
          case CONFIG.RequestType.RENAME: 
              targetsRow.forEach(y => { y.name = x.label.name; });
              targetsEle.forEach(y => { y._private.data['props']['name'] = x.label.name;
                                        y._private.data['name'] = x.label.name;
                                        y.style('label', x.label.name);
              });
              break;
        }
      }, 
      err => { console.log('error:', err); }, 
      () => { console.log('completed!!'); }
    );
  }

  ///////////////////////////////////////////////////////////

/*
https://bitnine.net/wp-content/uploads/2016/11/AgensGraph_Quick_Guide.pdf

<ALTER LABEL>
ALTER [ IF EXISTS ] VLABEL label_name RENAME TO new_name
ALTER [ IF EXISTS ] VLABEL label_name OWNER TO new_owner
ALTER [ IF EXISTS ] VLABEL label_name SET STORAGE { PLAIN | EXTERNAL | EXTENDED | MAIN }
ALTER [ IF EXISTS ] VLABEL label_name SET TABLESPACE new_tablespace
ALTER [ IF EXISTS ] VLABEL label_name CLUSTER ON idxname
ALTER [ IF EXISTS ] VLABEL label_name SET WITHOUT CLUSTER
ALTER [ IF EXISTS ] VLABEL label_name SET LOGGED
ALTER [ IF EXISTS ] VLABEL label_name SET UNLOGGED
ALTER [ IF EXISTS ] VLABEL label_name INHERIT parent_label
ALTER [ IF EXISTS ] VLABEL label_name NO INHERIT parent_label
ALTER [ IF EXISTS ] VLABEL label_name DISABLE INDEX
*/  
}
