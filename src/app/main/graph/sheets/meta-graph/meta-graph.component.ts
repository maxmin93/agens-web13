import { Component, OnInit, NgZone, ViewChild, ElementRef, Inject, Output, EventEmitter} from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';

import { Observable, Subject } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../app.config';

import * as cytoscape from 'cytoscape';

declare var _: any;
declare var $: any;
declare var agens: any;

@Component({
  selector: 'app-meta-graph',
  templateUrl: './meta-graph.component.html',
  styleUrls: ['./meta-graph.component.scss']
})
export class MetaGraphComponent implements OnInit {

  isVisible: boolean = false;
  metaGraph: IGraph = undefined;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('divPopup', {read: ElementRef}) divPopup: ElementRef;

  constructor(
    private _ngZone: NgZone,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<MetaGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any        
  ) {
    this.metaGraph = (this.data) ? _.cloneDeep(this.data['metaGraph']) : undefined;
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

    this.cy.userZoomingEnabled( true );
    agens.cy = this.cy;  
  }

  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['metaGraphComponentRef'] = undefined;
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      console.log( 'meta-graph.tapEvent:', e.target);
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);
    });

    if( this.metaGraph ){
      this.initLoad();
      console.log( 'after initLoad():', this.cy.nodes()[0]);
      // this.selectedElement = this.cy.nodes()[0];
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
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, value:string ){
    console.log( 'qtipMenuCallback:', target, value );
    // let expandId = target.data('label')+'_'+target.data('id');
    // target.scratch('_expandid', expandId);
    // let position = target.position();
    // let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };
    // this.runExpandTo( target, targetLabel );
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

  setGid( gid:number ){ this.gid = gid; }
  addLabel( label:ILabel ){
    this.labels.push( label );
  }
  addNode( ele:INode ){
    this.cy.add( ele );
  }
  addEdge( ele:IEdge ){
    this.cy.add( ele );
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas(){
    // add groupBy menu
    this.addQtipMenu( this.cy.elements() );
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }
  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.changeLayout( this.cy.elements(`[label!='property']`) );
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

  /////////////////////////////////////////////////////////////////
  // Properties Controllers
  /////////////////////////////////////////////////////////////////

  addQtipMenu( elements:any ){
    //
    // **NOTE: cy.on('cxttap', fun..) 구문을 사용하면 안먹는다 (-_-;)
    // 
    // mouse right button click event on nodes
    elements.qtip({
      content: function() { return this.divPopup.nativeElement; },
      style: { classes: 'qtip-bootstrap', tip: { width: 24, height: 8 } },
      position: { target: 'mouse', adjust: { mouse: false } },
      events: { visible: function(event, api) { $('.qtip').click(function(){ $('.qtip').hide(); }); } },
      show: { event: 'cxttap' },          // cxttap: mouse right button click event
      hide: { event: 'click unfocus' }
    });    
  }

  unfoldProperties(){
    this.cy.$api.view.show( this.cy.elements(`[label='property']`) );
    setTimeout(() => {
      this.cy.style(agens.graph.stylelist['dark']).update();
      this.cy.fit( this.cy.elements(), 50);
    }, 100);
  }

  foldProperties(){
    this.cy.$api.view.hide( this.cy.elements(`[label='property']`) );
    this.cy.fit( this.cy.elements(), 50);
  }
}
