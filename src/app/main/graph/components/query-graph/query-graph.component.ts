import { Component, OnInit, NgZone, ViewChild, ElementRef, Input } from '@angular/core';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../global.config';

declare var agens: any;

@Component({
  selector: 'app-query-graph',
  templateUrl: './query-graph.component.html',
  styleUrls: ['./query-graph.component.scss','../../graph.component.scss']
})
export class QueryGraphComponent implements OnInit {

  isVisible: boolean = false;

  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  // material elements
  @ViewChild('btnMouseWheelZoom') public btnMouseWheelZoom: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
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
    window['dataGraphComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () =>{ if(this.isVisible) this.cyCanvasCallback() },
      cyElemCallback: (target) =>{ if(this.isVisible) this.cyElemCallback(target) },
      cyNodeCallback: (target) =>{ if(this.isVisible) this.cyNodeCallback(target) },
      cyQtipMenuCallback: (target, value) =>{ if(this.isVisible) this.cyQtipMenuCallback(target, value) },
      component: this
    };
  }

  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['dataGraphComponentRef'] = undefined;
  }

  ngAfterViewInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        container: document.getElementById('graph-canvas'),
        selectionType: 'additive',  // 'single' or 'additive'
        boxSelectionEnabled: true,  // if single then false, else true
        useCxtmenu: true,           // whether to use Context menu or not
        hideNodeTitle: true,        // hide nodes' title
        hideEdgeTitle: true,        // hide edges' title
      });
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
    console.log("data-graph.elem-click:", target);

    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;

    // HighlightNeighbors 상태가 아닌 일반 상태라면 unselect
    if( !this.btnHighlightNeighbors.checked ){
      agens.cy.elements(':selected').unselect();
    }
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, targetLabel:string ){
    let expandId = target.data('label')+'_'+target.data('id');
    target.scratch('_expandid', expandId);

    let position = target.position();
    let boundingBox = { x1: position.x - 40, x2: position.x + 40, y1: position.y - 40, y2: position.y + 40 };

    // this.runExpandTo( target, targetLabel );
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
    // 그래프 관련 콘트롤러들 초기화
    this.toggleMouseWheelZoom(false);
    this.toggleHighlightNeighbors(false);
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
    this.cy.style(agens.graph.stylelist['dark']).update();
    if( this.isVisible ) this.cy.$api.changeLayout('cose');
  }
  resize(){
    this.cy.resize();
  }
  refreshCanvas(){
    this.refresh();
    this.resize();
  }

  // graph 데이터
  showResultGraph(data:IGraph){
    if( data === null || data.nodes === null || data.nodes.length === 0 ) return;

    // label chips
    this.labels = data.labels;
  }

  adjustMenuOnNode(labels: Array<ILabel>, collection:any ){

  }

  // add $$color property ==> ILabelType, INode.data, IEdge.data
  // ** 참고: https://github.com/davidmerfield/randomColor
  randomStyleInjection(data:IGraph, stats:any){

  }

  clickGraphLabelChip( labelType:string, labelName:string ): void {

  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    if( this.isVisible ) this.cy.$api.changeLayout(layout);
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  selectedLockToggle(target:any){
  }

  toggleMouseWheelZoom(checked?:boolean): void{
  }

  toggleHighlightNeighbors(checked?:boolean): void{
  }

  /////////////////////////////////////////////////////////////////
  // Search in Result Dialog
  /////////////////////////////////////////////////////////////////

  openSearchResultDialog(): void {
    // if( this.cy.elements().length == 0 || this.graphLabels.length == 0 ) return;

    // let inputData = {
    //   labels: this.graphLabels,
    //   labelPallets: this.labelColors
    // };
    // let dialogRef = this.dialog.open( SearchResultDialog, {
    //   width: '400px', height: 'auto',
    //   data: inputData
    // });

    // dialogRef.afterClosed().subscribe(result => {
    //   console.log('SearchResultDialog was closed:', result );
    //   if( result === null ) return;

    //   result.select().addClass('highlighted');
    // });
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////

  openLabelStyleSettingDialog(): void {
  }

  // 라벨에 대한 스타일 바꾸기
  // **NOTE: project load 한 상태에서는 resultDto가 없기 때문에
  //          graphLabels 와 graphData 내에서만 해결해야 한다!!
  private changeLabelStyle(styleChange:any){

    // 1) ILabelType.$$style 변경,
    let label:ILabel = this.labels.filter(function(val){ return styleChange.target === val.id; })[0];
    label.scratch['_style'] = <IStyle>{ color: styleChange.color, width: styleChange.size+'px', title: styleChange.title };

    // 2) graphAgens.elements() 중 해당 label 에 대한 $$style 변경
    let elements = [];
    if( label.type == 'nodes' ) elements = this.cy.nodes();
    else elements = this.cy.edges();
    for( let i=0; i<elements.length; i+= 1){
      if( elements[i].data('label') == label.name ){
        elements[i].data('$$style', { _self: { color: null, size: null, label: null }, _label: label['$$style'] });
      }
    }

    // 3) apply
    this.cy.style().update();
  }

  /////////////////////////////////////////////////////////////////
  // Label Style Setting Controllers
  /////////////////////////////////////////////////////////////////

  openImageExportDialog(){
    // recordTable에 결과가 없어도 graph 에 출력할 내용물이 있으면 OK!
    if( this.cy.elements(':visible').length === 0 ) return;

    // let dialogRef = this.dialog.open(ImageExportDialog, {
    //   width: 'auto', height: 'auto',
    //   data: this.cy
    // });

    // dialogRef.afterClosed().subscribe(result => {
    //   if( result === null ) return;

    //   // agens.graph.exportImage 호출
    //   agens.graph.exportImage( result.filename, result.watermark );
    // });
  }

  /////////////////////////////////////////////////////////////////
  // Centrality methods
  /////////////////////////////////////////////////////////////////

  centralrityPR(){
    let centrality = agens.cy.elements().pageRank();
    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityPr', centrality.rank(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityPr') < acc[0] ) ? cur.scratch('_centralrityPr') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityPr') > acc[1] ) ? cur.scratch('_centralrityPr') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityPr') : acc[2] + cur.scratch('_centralrityPr');   // sum
        return acc;
      }, []);
    console.log( 'pageRank Centrality: ', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityPr') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }

  centralrityDg(){
    let centrality = agens.cy.elements().degreeCentralityNormalized();
    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityDg', centrality.degree(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityDg') < acc[0] ) ? cur.scratch('_centralrityDg') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityDg') > acc[1] ) ? cur.scratch('_centralrityDg') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityDg') : acc[2] + cur.scratch('_centralrityDg');   // sum
        return acc;
      }, []);
    console.log( 'Degree Centrality: ', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityDg') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }

  centralrityCn(){
    let centrality = agens.cy.elements().closenessCentralityNormalized();

    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityCn', centrality.closeness(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityCn') < acc[0] ) ? cur.scratch('_centralrityCn') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityCn') > acc[1] ) ? cur.scratch('_centralrityCn') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityCn') : acc[2] + cur.scratch('_centralrityCn');   // sum
        return acc;
      }, []);
    console.log( 'Closeness Centrality:', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityCn') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }
  
  centralrityBt(){
    let centrality = agens.cy.elements().betweennessCentrality();

    agens.cy.nodes().map(ele => {
      ele.scratch('_centralrityBt', centrality.betweenness(ele));
    });
    let acc = agens.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityBt') < acc[0] ) ? cur.scratch('_centralrityBt') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityBt') > acc[1] ) ? cur.scratch('_centralrityBt') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityBt') : acc[2] + cur.scratch('_centralrityBt');   // sum
        return acc;
      }, []);
    console.log( 'Betweenness Centrality:', acc[0], acc[1], acc[2]/agens.cy.nodes().size() );
    agens.cy.nodes().map(ele => {
      let val = Math.floor( (ele.scratch('_centralrityBt') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      console.log( ele.id(), ele.data('name'), val );
      ele.style('width', val).style('height', val);
    });
  }
  
}
