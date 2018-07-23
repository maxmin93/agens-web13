import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';

import { Observable, of, from, Subscription, concat } from 'rxjs';

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
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty } from '../../models/agens-data-types'
import { IResponseDto } from '../../models/agens-response-types';
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import * as CONFIG from '../../global.config';
import { ISchemaDto } from '../../models/agens-response-types';

declare var agens: any;

const EMPTY_LABEL: ILabel = { 
  group: 'labels', oid: '', type: '', name: '', owner: '', desc: '', size: 0
  , properties: [], neighbors: [], scratch: { size_not_empty: 0, is_dirty: true }
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
  data: any;
  subscription: Subscription;
  datasource: IDatasource;
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
    { name: 'OID', prop: 'oid' },
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
  @ViewChild('tableProperties') tableProperties: DatatableComponent;
    
  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _angulartics2: Angulartics2,
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
      cyNodeCallback: (target) => this.cyNodeCallback(target),
      component: this
    };
  }
  ngOnDestroy(){
    if( this.subscription ) this.subscription.unsubscribe();
    // 내부-외부 함수 공유 해제
    window['angularComponentRef'] = null;
  }

  ngAfterViewInit() {
    this._api.changeMenu('main');

    // Cytoscape 생성 & 초기화
    agens.graph.defaultSetting.hideNodeTitle = false;
    agens.graph.defaultSetting.hideEdgeTitle = false;

    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'multiple'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: false,          // whether to use Context menu or not
        hideNodeTitle: false,       // hide nodes' title
        hideEdgeTitle: false,       // hide edges' title
      }
    );

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

  // graph elements 중 node 클릭 콜백 함수
  cyNodeCallback(target:any):void {
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    this.cy.elements(':selected').unselect();
    this.selectFromGraph(target.id());
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

  clearTables(){
    this.selectedLabels = <ILabel[]>[];
    this.selectedLabel = EMPTY_LABEL;
    this.deletedLabel = <ILabel>null;
    this.createdLabel = <ILabel>null;
  
    this.tableLabelsRows = new Array<ILabel>();
    this.tablePropertiesRows = new Array<IProperty>();  
  }

  //////////////////////////////////////////////

  callCoreSchema(){

    this.toggleProgress(true);
    this.data = this._api.getSchemaSubjects();

    this.data.info$.subscribe({
      next: (x:ISchemaDto) => {
        // console.log( 'this.schema.info$.subscribe:', x );        
        this.datasource = x.datasource;
        this.labels = x.labels;
        // 화면 출력 : ngAfterViewInit emitter 이후 실행
        Promise.resolve(null).then(() => {
          this.showDatasource(x);
          this.showTable(x.labels);
        });
      }
    });
    this.data.graph$.subscribe( (x:IGraph) => {
      // console.log( 'this.schema.graph$.subscribe:', x );
      this.graph = x;
      this.graph.labels = new Array<ILabel>();
      this.graph.nodes = new Array<INode>();
      this.graph.edges = new Array<IEdge>();
    });
    this.data.labels$.subscribe( (x:ILabel) => {
      // console.log( 'this.schema.labels$.subscribe:', x );
      this.graph.labels.push(x);
    });
    this.data.nodes$.subscribe( (x:INode) => {
      // console.log( 'this.schema.nodes$.subscribe:', x );
      this.injectElementStyle( x );
      this.graph.nodes.push(x);
      this.cy.add(x);
    });
    this.data.edges$.subscribe( (x:IEdge) => {
      // console.log( 'this.schema.edges$.subscribe:', x );
      this.injectElementStyle( x );
      this.graph.edges.push(x);
      this.cy.add(x);
    });

    // 작업 직렬화 : complete 시 post 작업 수행
    concat( this.data.info$.asObservable(), this.data.graph$.asObservable()
        , this.data.labels$.asObservable(), this.data.nodes$.asObservable(), this.data.edges$.asObservable() )
      .subscribe({
        complete: () => {
          this.showGraph();
          
          this.toggleProgress(false);
          console.log( 'callCoreSchema done!' );
        }
      });

    this.subscription = this._api.core_schema();  // call API
  }

  showDatasource(x:ISchemaDto){
    this.infos = {
      uri: x.datasource.jdbc_url, name: x.datasource.name, owner: x.datasource.owner, desc: x.datasource.desc
      , nodes_size_total: x.labels.filter(x => x.type == 'nodes').length
      , edges_size_total: x.labels.filter(x => x.type == 'edges').length
      , nodes_size_data:  x.labels.filter(x => x.type == 'nodes' && x.size > 0).length
      , edges_size_data:  x.labels.filter(x => x.type == 'edges' && x.size > 0).length
    };
  }

  showTable(labels:Array<ILabel>){
    this.tableLabelsRows = [...labels];

    // graph에 select 처리
    if( labels.length > 0 ){
      this.selectedLabel = this.tableLabelsRows[0];
      this.selectFromTable(this.selectedLabel);
    }    
  }

  showGraph(){
    this.cy.$api.changeLayout('dagre');
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  ////////////////////////////////////////////////////////

  // ** 참고: https://github.com/davidmerfield/randomColor
  injectElementStyle( ele:IElement ){
    if( ele.group == 'nodes' )
      ele.scratch._style = {
          color: this.labelColors[ this.colorIndex%CONFIG.MAX_COLOR_SIZE ]
          , width: (50 + Math.floor(Math.log10(ele.data.size+1))*10) +'px'
          , title: null
      };
    else
      ele.scratch._style = {
          color: this.labelColors[ this.colorIndex%CONFIG.MAX_COLOR_SIZE ]
          , width: (2 + Math.floor(Math.log10(ele.data.size+1))*2) +'px'
          , title: null
      };      
    this.colorIndex += 1;
  }

  // 클릭된 element 해당하는 label 정보를 화면에 연결하기
  selectFromGraph(id:string):ILabel {
    // console.log( 'clicked id=', id.valueOf());
    for( let label of this.tableLabelsRows ){
      if( label.oid === id ) {
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
    this.cy.elements().getElementById(target.oid).select();

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
          this._api.setResponses(<IResponseDto>{
            group: 'core.command.deleteLabel',
            state: CONFIG.StateType.ERROR,
            message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
          });
        }
      );
    });
  }

  deleteLabelUpdate(target:ILabel){
    this.deletedLabel = target;
    console.log('deleteLabelUpdate:', target);

    // canvas 에서 삭제
    this.cy.elements().getElementById(target.oid).remove();
    // table 에서 삭제하고 refresh
    let idx = this.labels.findIndex(ele => ele.oid == target.oid);
    if( idx >= 0 ){
      this.labels.splice(idx, 1);
      this.tableLabelsRows = [...this.labels];  //_.clone(this.labels);
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
          this._api.setResponses(<IResponseDto>{
            group: 'core.command.deleteLabel',
            state: CONFIG.StateType.ERROR,
            message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
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
    if( target.type === 'NODE' ){
      if( this.cy.$api.view !== undefined ) this.cy.$api.view.removeHighlights();
      this.cy.elements(':selected').unselect();
      this.cy.center();
      let ele = this.cy.add({
        group: 'nodes',
        data: { id: target.oid, labels: ['NODE'], name: target.name, size: 0, props: target.properties },
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
