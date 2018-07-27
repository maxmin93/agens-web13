import { Component, OnInit, NgZone, ViewChild, ElementRef, Input} from '@angular/core';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../global.config';

declare var agens: any;

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {


  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _ngZone: NgZone,    
    private dialog: MatDialog,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
  }


  ngOnInit() {
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () => this.cyCanvasCallback(),
      cyElemCallback: (target) => this.cyElemCallback(target),
      cyNodeCallback: (target) => this.cyNodeCallback(target),
      cyQtipMenuCallback: (target, value) => this.cyQtipMenuCallback(target, value),
      component: this
    };
  }

  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['angularComponentRef'] = null;
  }

  ngAfterViewInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        container: document.getElementById('statistics-canvas'),
        selectionType: 'additive',    // 'single' or 'additive'
        boxSelectionEnabled: true, // if single then false, else true
        useCxtmenu: true,          // whether to use Context menu or not
        hideNodeTitle: true,       // hide nodes' title
        hideEdgeTitle: true,       // hide edges' title
      });

    console.log( 'Statistics.ngAfterViewInit');
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
  }

  // graph elements 중 node 클릭 콜백 함수
  cyNodeCallback(target:any):void {

  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, targetLabel:string ){
    let expandId = target.data('labels')[0]+'_'+target.data('id');
    target.scratch('_expandid', expandId);

    let position = target.position();
    let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };

    // this.runExpandTo( target, targetLabel );
    // this._angulartics2.eventTrack.next({ action: 'expandTo', properties: { category: 'graph', label: `${target.data('labels')[0]}-->${targetName}` }});
  }
  
  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#graphProgressBar');
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
    this.timeoutNodeEvent = undefined;
  }

  addLabel( label:ILabel ){
    this.labels.push( label );
  }
  addNode( ele:INode ){
    this.cy.add( ele );
  }
  addEdge( ele:IEdge ){
    this.cy.add( ele );
  }
  refresh(){
    // if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    // this.cy.elements(':selected').unselect();
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    if( this.cy.$api.changeLayout ) this.cy.$api.changeLayout();
  }

  resize(){
    this.cy.resize();
  }

  refreshCanvas(){
    this.refresh();
    this.resize();
  }
}