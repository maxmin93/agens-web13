import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, Inject, ChangeDetectorRef } from '@angular/core';

import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import {FormBuilder, FormGroup} from '@angular/forms';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';

declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-edit-graph',
  templateUrl: './edit-graph.component.html',
  styleUrls: ['./edit-graph.component.scss']
})
export class EditGraphComponent implements OnInit, AfterViewInit {
  
  options: FormGroup;

  metaGraph: IGraph = undefined;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;
  ele_name: string = '';

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('testEle', {read: ElementRef}) divPopup: ElementRef;

  constructor(
    public fb: FormBuilder,
    private _cd: ChangeDetectorRef,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<EditGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any
  ) { 
    this.metaGraph = (this.data) ? _.cloneDeep(this.data['metaGraph']) : undefined;   

    this.options = fb.group({
      hideRequired: false,
      floatLabel: 'auto',
    });
  }

  ngOnInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'additive'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: false,           // whether to use Context menu or not
        hideNodeTitle: false,        // hide nodes' title
        hideEdgeTitle: false,        // hide edges' title
      });
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);

      // change Detection by force
      this._cd.detectChanges();
    });

    if( this.metaGraph ){
      this.initLoad();
      this.selectedElement = this.cy.nodes()[0];
    }
  }

  close(): void {
    this._sheetRef.dismiss();
    event.preventDefault();
  }

  initLoad(){
    this._util.calcElementStyles( this.metaGraph.nodes, (x)=>40+x*5, false );
    this._util.calcElementStyles( this.metaGraph.edges, (x)=>2+x, false );

    this.metaGraph.nodes.forEach(e => {
      e.classes += ' dataLabel';
      this.cy.add( e );
    });
    this.metaGraph.edges.forEach(e => {
      e.classes += ' dataLabel';
      this.cy.add( e );
    });
    this.initCanvas();

    this.changeLayout( this.cy.elements() );
  }

  setGid( gid:number ){ this.gid = gid; }  

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
    this.ele_name = this.selectedElement._private.data.name;
    console.log( 'meta-graph.click:[0]', this.ele_name, this.selectedElement);
  }  

  cyQtipMenuCallback( target:any, value:string ){
    console.log( 'qtipMenuCallback:', target, value );
  }
  
  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarMetaGraph');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    this.labels = [];
    this.selectedElement = undefined;
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas(){
    // // add groupBy menu
    // this.addQtipMenu( this.cy.elements() );
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }
  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.changeLayout( this.cy.elements() );
    agens.cy = this.cy;
  }

  changeLayout( elements ){
    let options = { name: 'cose',
      nodeDimensionsIncludeLabels: true, fit: true, padding: 50, animate: false, 
      randomize: false, componentSpacing: 80, nodeOverlap: 4,
      idealEdgeLength: 50, edgeElasticity: 50, nestingFactor: 1.5,
      gravity: 0.5, numIter: 1000
    };    
    // adjust layout
    elements.layout(options).run();
  }

}
