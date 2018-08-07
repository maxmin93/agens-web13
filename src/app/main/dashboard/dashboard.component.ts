import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

import { Observable, of, from, Subject, Subscription, concat, forkJoin } from 'rxjs';
import { map, filter, concatAll } from 'rxjs/operators';

import { Angulartics2 } from 'angulartics2';
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
import * as CONFIG from '../../global.config';
import { ISchemaDto } from '../../models/agens-response-types';

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
  
  // pallets : Node 와 Edge 라벨별 color 셋
  colorIndex: number = 0;
  labelColors: any[] = [];

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
    private _angulartics2: Angulartics2,
    private _router: Router,
    public dialog: MatDialog,
    private _ngZone: NgZone,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
  }

  ngOnInit(){
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () => this.cyCanvasCallback(),
      cyElemCallback: (target) => this.cyElemCallback(target),
      cyQtipMenuCallback: (target, value) => this.cyQtipMenuCallback(target, value),
      component: this
    };    
  }
  ngOnDestroy(){
    this.clearSubscriptions();
    // 내부-외부 함수 공유 해제
    window['angularComponentRef'] = undefined;
  }

  ngAfterViewInit() {
    this._api.changeMenu('main');

    // Cytoscape 생성 & 초기화
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'multiple'
        boxSelectionEnabled: false, // if single then false, else true
        userCxtmenu: true,          // whether to use Context menu or not
        hideNodeTitle: false,       // hide nodes' title
        hideEdgeTitle: false,       // hide edges' title
      }
    );
    // Cytoscape 바탕화면 qTip menu
    this.cy.qtip({
      content: function(e){ 
        let html:string = `<div class="hide-me"><h4><strong>Menu</strong></h4><hr/><ul>`;
        html += `<li><a href="javascript:void(0)" onclick="agens.cy.$api.cyQtipMenuCallback('core','addNode')">create new NODE</a></li>`;
        html += `</ul></div>`;
        return html;
      },
      show: { event: 'cxttap', cyBgOnly: true },    // cxttap: mouse right button click event
      hide: { event: 'click unfocus' },
      position: { target: 'mouse', adjust: { mouse: false } },
      style: { classes: 'qtip-bootstrap', tip: { width: 16, height: 8 } },
      events: { visible: function(event, api) { $('.qtip').click(function(){ $('.qtip').hide(); }); } }
    });

    // pallets 생성 : luminosity='dark'
    this.labelColors = this._util.randomColorGenerator('dark', CONFIG.MAX_COLOR_SIZE);

    // schemaData
    this.callCoreSchema();
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

  refresh(){
    // if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    // this.cy.elements(':selected').unselect();
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.$api.changeLayout('klay');
    agens.cy = this.cy;
  }
  resize(){
    this.cy.resize();
    this.cy.fit( this.cy.elements(), 100);
  }
  refreshCanvas(){
    this.refresh();
    this.resize();
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
        this.injectElementStyle( x );
        this.graph.nodes.push(x);
        this.cy.add(x);
      });
    this.handlers[4] = data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.injectElementStyle( x );
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
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.$api.changeLayout('klay');    
  }

  ////////////////////////////////////////////////////////

  // ** 참고: https://github.com/davidmerfield/randomColor
  injectElementStyle( ele:IElement ){
    if( ele.group == 'nodes' )
      ele.scratch._style = {
          color: this.labelColors[ this.colorIndex%CONFIG.MAX_COLOR_SIZE ]
          , width: (50 + Math.floor(Math.log10(ele.data['size']+1))*10) +'px'
          , title: 'name'
        };
    else if( ele.group == 'edges' )
      ele.scratch._style = {
          color: this.labelColors[ this.colorIndex%CONFIG.MAX_COLOR_SIZE ]
          , width: (2 + Math.floor(Math.log10(ele.data['size']+1))*2) +'px'
          , title: 'name'
        };
    this.colorIndex += 1;
  }

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
