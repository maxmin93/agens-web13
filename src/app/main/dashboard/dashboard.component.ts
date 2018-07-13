import { Component, AfterViewInit } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';

import { Angulartics2 } from 'angulartics2';
import * as _ from 'lodash';

// ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty } from '../../models/agens-data-types'
import { Label, Element, Node, Edge } from '../../models/agens-graph-types';
import * as CONFIG from '../../global.config';

declare var agens: any;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit {

  // cytoscape 객체
  private graph:any = null;
  // 로딩 상태
  isLoading:boolean = false;
  // pallets : Node 와 Edge 라벨별 color 셋
  labelColors: any[] = [];

  // 화면 출력
  productInfo: any = { product: '', version: '', message: '', user_name: '', timestamp: '' };
  graphInfo: IDatasource = <IDatasource>{ oid: '', name: '', owner: '', desc: '', jdbc_url: '', is_dirty: true };
  metaInfo: any = { labels_size: 0, nodes_size_total: 0, edges_size_total: 0, nodes_size_data: 0, edges_size_data: 0 };

  // 선택 label
  selectedLabels: ILabel[] = [];
  selectedLabel: ILabel = { group: 'labels', oid: '', type: '', name: '', owner: '', desc: ''
              , size: 0, size_not_empty: 0, is_dirty: true
              , properties: [], neighbors: [] };
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
    
  @ViewChild('divGraph', {read: ElementRef}) divGraph: ElementRef;

  constructor(
    private _angulartics2: Angulartics2,    
    private _ngZone: NgZone,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () => this.cyCanvasCallback(),
      cyElemCallback: (value) => this.cyElemCallback(value),
      cyNodeCallback: (value) => this.cyNodeCallback(value),
      component: this
    };    
  }

  ngOnInit(){
  }

  ngAfterViewInit() {
    this._api.changeMenu('main');

    // Cytoscape 생성
    this.graph = agens.graph.graphFactory(
      this.divGraph.nativeElement, 'single', false
    );

    // pallets 생성 : luminosity='dark'
    this.labelColors = this._util.randomColorGenerator('dark', CONFIG.MAX_COLOR_SIZE);
  }


  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
  }

  // graph elements 중 node 클릭 콜백 함수
  cyNodeCallback(cyTarget:any):void {
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(cyTarget:any):void {
    // // qtip2
    // cyTarget.qtip({ 
    //   style: 'qtip-blue',
    //   position: { my: 'bottom left', at: 'top right' },          
    //   content: {
    //       title: cyTarget.data('labels')[0]+' ['+cyTarget.id()+']',
    //       text: function(){ 
    //         var text = 'name: '+cyTarget.data('name')+'<br>size: '+cyTarget.data('size');
    //         if(cyTarget.data('props').hasOwnProperty('desc')) text += '<br>desc: '+cyTarget.data('props')['desc'];
    //         return text;
    //       }
    //   } });
  }

}
