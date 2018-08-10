import { Component, OnInit, NgZone, ViewChild, ElementRef, Input, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { MatDialog, MatButtonToggle, MatSlideToggle } from '@angular/material';

import { Observable, Subject, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';
import { IDoubleListDto } from '../../../../models/agens-response-types';

import * as CONFIG from '../../../../global.config';
import { delayWhen } from '../../../../../../node_modules/rxjs/operators';

declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-query-graph',
  templateUrl: './query-graph.component.html',
  styleUrls: ['./query-graph.component.scss','../../graph.component.scss']
})
export class QueryGraphComponent implements OnInit, AfterViewInit, OnDestroy {

  isVisible: boolean = false;
  isLoading: boolean = false;

  btnStatus: any = { 
    showHideTitle: false,     // Node Title 노출여부 
    mouseWheel: false,        // 마우스휠 사용여부
    shortestPath: false,      // 경로검색 사용여부 
    neighbors: false,         // 이웃노드 하일라이팅
  };

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  shortestPathOptions:any = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };

  // material elements
  @ViewChild('btnShortestPath') public btnShortestPath: MatButtonToggle;
  @ViewChild('slideShortestPathDirected') public slideSPathDirected: MatSlideToggle;
  @ViewChild('btnShowHideTitle') public btnShowHideTitle: MatButtonToggle;
  // @ViewChild('btnMouseWheelZoom') public btnMouseWheelZoom: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  @Output() initDone:EventEmitter<boolean> = new EventEmitter();
  todo$:Subject<any> = new Subject();
  
  constructor(
    private _ngZone: NgZone,
    private _elf: ElementRef,
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
        selectionType: 'additive',  // 'single' or 'additive'
        boxSelectionEnabled: true,  // if single then false, else true
        useCxtmenu: true,           // whether to use Context menu or not
        hideNodeTitle: true,        // hide nodes' title
        hideEdgeTitle: true,        // hide edges' title
      });

    setTimeout(() => this.cy.userZoomingEnabled( true ), 30);
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
    console.log("data-graph.elem-click:", target);

    // null 이 아니면 정보창 (infoBox) 출력
    if( this.btnStatus.shortestPath ) this.selectFindShortestPath(target);
    if( this.btnStatus.neighbors ) this.highlightNeighbors(target);
    else{
      this.selectedElement = target;
      // HighlightNeighbors 상태가 아닌 일반 상태라면 unselect
      if( !this.btnHighlightNeighbors.checked ){
        this.cy.elements(':selected').unselect();
      }
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
    let graphProgressBar:any = document.querySelector('div#progressBarQueryGraph');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(option:boolean=true){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 라벨 칩리스트 비우고
    if( option ) this.labels = [];
    this.selectedElement = undefined;
    this.timeoutNodeEvent = undefined;
    // 그래프 관련 콘트롤러들 초기화
    this.toggleShowHideTitle(true);
    this.toggleHighlightNeighbors(false);
  }

  setGid( gid: number ){ this.gid = gid; }
  addLabel( label:ILabel ){ this.labels.push( label ); }
  addNode( ele:INode ){ this.cy.add( ele ); }
  addEdge( ele:IEdge ){ this.cy.add( ele ); }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas(){
    // if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    // this.cy.elements(':selected').unselect();
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);

    this.initDone.emit(this.isVisible);
  }

  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.cy.fit( this.cy.elements(), 50);
    agens.cy = this.cy;
  }

  adjustMenuOnNode(labels: Array<ILabel>, collection:any ){

  }

  clickGraphLabelChip( labelType:string, labelName:string ): void {
    this.cy.elements(':selected').unselect();
    setTimeout(()=>{
      let group = (labelType == 'edges') ? 'edge' : 'node';
      this.cy.elements(`${group}[label='${labelName}']`).select();
    }, 20);
  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    if( this.isVisible ) 
      this.cy.$api.changeLayout(layout, {
        "padding": 50
        , "ready": () => this.toggleProgressBar(true)
        , "stop": () => this.toggleProgressBar(false)
      });
  }

  /////////////////////////////////////////////////////////////////
  // Editor Controllers
  /////////////////////////////////////////////////////////////////

  selectedLockToggle(target:any){
    if( target.locked() ) target.unlock();
    else target.lock();
  }

  // toggleMouseWheelZoom(checked?:boolean): void{
  //   if( checked === undefined ) this.btnMouseWheelZoom.checked = !this.btnMouseWheelZoom.checked;
  //   else this.btnMouseWheelZoom.checked = checked;

  //   // graph의 userZoomingEnabled 설정 변경
  //   this.cy.userZoomingEnabled( this.btnMouseWheelZoom.checked ); 
  //   this.btnStatus.mouseWheel = this.btnMouseWheelZoom.checked;
  // }

  toggleShowHideTitle(checked?:boolean): void{
    if( checked === undefined ) this.btnShowHideTitle.checked = !this.btnShowHideTitle.checked;
    else this.btnShowHideTitle.checked = checked;
    this.btnStatus.showHideTitle = this.btnShowHideTitle.checked;

    // graph의 userZoomingEnabled 설정 변경
    this.cy.scratch('_config').hideNodeTitle = this.btnShowHideTitle.checked; 
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  toggleHighlightNeighbors(checked?:boolean): void{
    if( checked === undefined ) this.btnHighlightNeighbors.checked = !this.btnHighlightNeighbors.checked;
    else this.btnHighlightNeighbors.checked = checked;
    this.btnStatus.neighbors = this.btnHighlightNeighbors.checked;
  }

  highlightNeighbors(target){
    // neighbors select
    let neighbors = this.cy.$api.findNeighbors(target, [], 3);
    this.cy.$api.view.highlight(neighbors);
    Promise.resolve(null).then(() => { neighbors.select(); });
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
  
  graphCentrality(option:string='degree'){ 
    // options: degree, pagerank, closeness, betweenness
    switch( option ){
      case 'degree': this.centralrityDg();      break;
      case 'pagerank': this.centralrityPR();    break;
      case 'closeness': this.centralrityCn();   break;
      case 'betweenness': this.centralrityBt(); break;
      default: 
        this.cy.elements().forEach(e => {
          e.scratch('_style', _.clone(e.scratch('_styleBak')));
        });
    }
    this.cy.style(agens.graph.stylelist['dark']).update();

  }

  centralrityPR(){
    let centrality = this.cy.elements().pageRank();
    this.cy.nodes().map(ele => {
      ele.scratch('_centralrityPr', centrality.rank(ele));
    });
    let acc = this.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityPr') < acc[0] ) ? cur.scratch('_centralrityPr') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityPr') > acc[1] ) ? cur.scratch('_centralrityPr') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityPr') : acc[2] + cur.scratch('_centralrityPr');   // sum
        return acc;
      }, []);
    console.log( 'pageRank Centrality: ', acc[0], acc[1], acc[2]/this.cy.nodes().size() );
    this.cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityPr') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value + 'px';
    });
  }

  centralrityDg(){
    let centrality = this.cy.elements().degreeCentralityNormalized();
    this.cy.nodes().map(ele => {
      ele.scratch('_centralrityDg', centrality.degree(ele));
    });
    let acc = this.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityDg') < acc[0] ) ? cur.scratch('_centralrityDg') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityDg') > acc[1] ) ? cur.scratch('_centralrityDg') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityDg') : acc[2] + cur.scratch('_centralrityDg');   // sum
        return acc;
      }, []);
    console.log( 'Degree Centrality: ', acc[0], acc[1], acc[2]/this.cy.nodes().size() );
    this.cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityDg') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value + 'px';
    });
  }

  centralrityCn(){
    let centrality = this.cy.elements().closenessCentralityNormalized();

    this.cy.nodes().map(ele => {
      ele.scratch('_centralrityCn', centrality.closeness(ele));
    });
    let acc = this.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityCn') < acc[0] ) ? cur.scratch('_centralrityCn') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityCn') > acc[1] ) ? cur.scratch('_centralrityCn') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityCn') : acc[2] + cur.scratch('_centralrityCn');   // sum
        return acc;
      }, []);
    console.log( 'Closeness Centrality:', acc[0], acc[1], acc[2]/this.cy.nodes().size() );
    this.cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityCn') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value + 'px';
    });
  }
  
  centralrityBt(){
    let centrality = this.cy.elements().betweennessCentrality();

    this.cy.nodes().map(ele => {
      ele.scratch('_centralrityBt', centrality.betweenness(ele));
    });
    let acc = this.cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityBt') < acc[0] ) ? cur.scratch('_centralrityBt') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityBt') > acc[1] ) ? cur.scratch('_centralrityBt') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityBt') : acc[2] + cur.scratch('_centralrityBt');   // sum
        return acc;
      }, []);
    console.log( 'Betweenness Centrality:', acc[0], acc[1], acc[2]/this.cy.nodes().size() );
    this.cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityBt') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value + 'px';
    });
  }
  
  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  toggleFindShortestPath(option:boolean=undefined){
    if( !option ) this.btnStatus.shortestPath = !this.btnStatus.shortestPath;
    else this.btnStatus.shortestPath = option;

    // enable 모드이면 options 리셋
    if( this.btnStatus.shortestPath ){
      this.shortestPathOptions = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };

    }
  }

  selectFindShortestPath(target:any){
    this.cy.elements(':selected').unselect();
    if( target.isNode() ){
      this.shortestPathOptions.order += 1;
      if( this.shortestPathOptions.order % 2 == 1 ){
        this.shortestPathOptions.sid = target.id();
        this.shortestPathOptions.eid = undefined;
        setTimeout(() => {         
          this.cy.nodes(`#${this.shortestPathOptions.sid}`).select();
        }, 30);
      } 
      else {
        this.shortestPathOptions.eid = target.id();
        setTimeout(() => {         
          this.cy.nodes(`#${this.shortestPathOptions.sid}, #${this.shortestPathOptions.eid}`).select();
        }, 30);
      }
    }
  }

  doFindShortestPath(directed:boolean=false){
    this.cy.elements(':selected').unselect();

    let dijkstra = this.cy.elements().dijkstra(
      this.cy.getElementById(this.shortestPathOptions.sid)
      , function(edge){ return !edge.data('weight') ? 1 : edge.data('weight'); }
      , this.slideSPathDirected.checked );
    
    let pathTo = dijkstra.pathTo( this.cy.getElementById(this.shortestPathOptions.eid) );
    if( !pathTo.empty() ){
      this.shortestPathOptions.distTo = dijkstra.distanceTo( this.cy.getElementById(this.shortestPathOptions.eid) );
      this.cy.$api.view.highlight(pathTo);
    }
  }

  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  toggleFindConnectedGroup(option:boolean=undefined){
    if( !option ) this.btnStatus.connectedGroup = !this.btnStatus.connectedGroup;
    else this.btnStatus.connectedGroup = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.connectedGroup ) {
      let groups:any[] = this.cy.elements().components();
      groups.forEach((grp,idx) => {
        this.cy.$api.grouping(grp.nodes(), 'group#'+idx);
      });
    }
    else {
      let parents:any = this.cy.nodes().parent();
      parents.forEach(target => {
        this.cy.$api.degrouping(target);
      });
    }
  }

}
