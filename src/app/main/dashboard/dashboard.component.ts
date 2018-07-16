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
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import * as CONFIG from '../../global.config';
import { ISchemaDto } from '../../models/agens-response-types';

declare var agens: any;

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
  selectedLabel: ILabel = { 
    group: 'labels', oid: '', type: '', name: '', owner: '', desc: ''
    , size: 0, size_not_empty: 0, is_dirty: true
    , properties: [], neighbors: [] 
  };
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
  }

  ngAfterViewInit() {
    this._api.changeMenu('main');

    // Cytoscape 생성 & 초기화
    agens.graph.defaultSetting.hideNodeTitle = false;
    agens.graph.defaultSetting.hideEdgeTitle = false;

    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, 'single', false
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
    this.graphFindLabel(target.id());
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
    this.selectedLabel = <ILabel>{ 
      group: 'labels', oid: '', type: '', name: '', owner: '', desc: ''
      , size: 0, size_not_empty: 0, is_dirty: true
      , properties: [], neighbors: [] 
    };
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
      , nodes_size_total: x.labels.filter(x => x.type == 'NODE').length
      , edges_size_total: x.labels.filter(x => x.type == 'EDGE').length
      , nodes_size_data:  x.labels.filter(x => x.type == 'NODE' && x.size > 0).length
      , edges_size_data:  x.labels.filter(x => x.type == 'EDGE' && x.size > 0).length
    };
  }

  showTable(labels:Array<ILabel>){
    this.tableLabelsRows = labels;

    // graph에 select 처리
    if( labels.length > 0 ){
      this.selectedLabel = this.tableLabelsRows[0];
      this.graphSelectElement(this.selectedLabel);
    }    
  }

  showGraph(){
    this.changeLayout('dagre');
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  ////////////////////////////////////////////////////////

  changeLayout(layout:string='euler'){
    let elements = this.cy.elements(':visible');

    let layoutOption = {
      name: layout,
      fit: true, padding: 30, boundingBox: undefined, 
      nodeDimensionsIncludeLabels: true, randomize: true,
      animate: false, animationDuration: 2800, maxSimulationTime: 2800, 
      ready: function(){}, stop: function(){},
      // for euler
      springLength: edge => 120, springCoeff: edge => 0.0008,
    };

    // adjust layout
    let layoutHandler = elements.layout(layoutOption);
    layoutHandler.on('layoutstart', function(){
      // 최대 3초(3000ms) 안에는 멈추도록 설정
      setTimeout(function(){
        layoutHandler.stop();
      }, 3000);
    });
    layoutHandler.run();
  }

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
  graphFindLabel(id:string):ILabel {
    // console.log( 'clicked id=', id.valueOf());
    for( let label of this.tableLabelsRows ){
      if( label.oid === id ) {
        this.selectedLabel = label;         // 라벨 정보창으로
        this.tablePropertiesRows = label.properties;  // 라벨 속성 테이블로

        // this._angulartics2.eventTrack.next({ action: 'graphSelect', properties: { category: 'main', label: label.type+'.'+label.name }});
        return label;
      }
    }
    return <ILabel>{ group: 'labels', oid: '', type: '', name: '', owner: '', desc: ''
                      , size: 0, size_not_empty: 0, is_dirty: true, properties: [] };
  }

  // 테이블에서 선택된 row 에 해당하는 graph element 선택 연동
  graphSelectElement(target:ILabel) {
    if( target === null ) return;
    // 기존꺼 unselect
    if( this.cy.viewUtil !== undefined ) this.cy.viewUtil.removeHighlights();
    this.cy.elements(':selected').unselect();
    // 선택한거 select
    let selector:string = `${target.type.toLowerCase()}[id='${target.oid}']`;
    this.cy.elements(selector).select();

    // 선택한거 테이블 내용 갱신
    this.selectedLabel = target;
    this.tablePropertiesRows = target.properties;

    // this._angulartics2.eventTrack.next({ action: 'tableSelect', properties: { category: 'main', label: target.type+'.'+target.name}});
  }

  onSelectTableLabels({ selected }){
    this.graphSelectElement(<ILabel> selected[0] );
  }

  /////////////////////////////////////////////////////////////////
  // Drop Label Controllers
  /////////////////////////////////////////////////////////////////

  removeLabelType(oid:string) {
    let label:ILabel = this.graphFindLabel(oid);
    if( label.oid === '' ) return;
    // confirm box 출력 (최종 확인뒤 라벨 삭제 api 호출)
    console.log(`removeLabelType(oid=${oid}): are you sure?`);

  }

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
      // this.callApiDropLabel( result );
    });
  }

  /////////////////////////////////////////////////////////////////
  // Create Label Controllers
  /////////////////////////////////////////////////////////////////

  openCreateLabelInputDialog(): void {
    let dialogRef = this.dialog.open( InputCreateLabelDialog, {
      width: '400px',
      data: this.tableLabelsRows
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('CreateLabelInputDialog was closed:', result );
      if( result === null ) return;

      // this.callApiCreateLabel(result);
    });
  }


}
