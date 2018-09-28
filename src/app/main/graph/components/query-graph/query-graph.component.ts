import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, HostListener, Output, EventEmitter, AfterViewInit, OnDestroy } from '@angular/core';
import { MatDialog, MatButtonToggle, MatButton, MatSlideToggle, MatBottomSheet } from '@angular/material';

import { Observable, Subject, interval } from 'rxjs';
import { filter } from 'rxjs/operators';

import { MetaGraphComponent } from '../../sheets/meta-graph/meta-graph.component';
import { EditGraphComponent } from '../../sheets/edit-graph/edit-graph.component';
import { TimelineSliderComponent } from '../timeline-slider/timeline-slider.component';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { AgensGraphService } from '../../../../services/agens-graph.service';

import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IEnd, IProperty } from '../../../../models/agens-data-types';
import { IGraphDto, IDoubleListDto } from '../../../../models/agens-response-types';

import * as CONFIG from '../../../../app.config';
import { FormControl } from '@angular/forms';

import * as moment from 'moment';

declare var jQuery: any;
declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-query-graph',
  templateUrl: './query-graph.component.html',
  styleUrls: ['./query-graph.component.scss','../../graph.component.scss'],
  host: {
    '(document:keyup)': 'handleKeyboardEvent($event)'
  }
})
export class QueryGraphComponent implements OnInit, AfterViewInit, OnDestroy {

  isVisible: boolean = false;
  isLoading: boolean = false;
  isTempGraph: boolean = false;
  canvasHover: boolean = false;

  selectedOption: string = undefined;
  btnStatus: any = { 
    showHideTitle: false,     // Node Title 노출여부 
    mouseWheel: false,        // 마우스휠 사용여부
    shortestPath: false,      // 경로검색 사용여부 
    neighbors: false,         // 이웃노드 하일라이팅
    connectedGroup: false,
    timeLine: false,          // 타임라인
    findCycles: false,        // 사이클 디텍션
    editGraph: false,
    megaGraph: false,
    labelStyle: false
  };
  labelSearchCount: number = 0;

  gid: number = undefined;
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips    <== 모든 스타일 정보 유지

  dataGraph: IGraph = undefined;
  metaGraph: IGraph = undefined;
  tempGraph: IGraph = undefined;

  selectedElement: any = undefined;  
  selectedLabel: ILabel = undefined;
  displayedLabelColumns: string[] = ['propName', 'propType', 'propCnt'];

  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  shortestPathOptions:any = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
  grph_data: string[][] = [];

  // ** Styles **
  colorsPallet: any[] = [];         // colors Pallet  

  // ** Timelines **
  timelineLabelCtl: FormControl;
  timelinePropertyCtl: FormControl;
  timelineFormatCtl: FormControl;
  timelineSampleCtl: FormControl;
  timelineDisabled: boolean = true;
  timeline_data: string[] = [];

  // material elements
  @ViewChild('btnShortestPath') public btnShortestPath: MatButtonToggle;
  @ViewChild('slideShortestPathDirected') public slideSPathDirected: MatSlideToggle;
  @ViewChild('btnShowHideTitle') public btnShowHideTitle: MatButtonToggle;
  @ViewChild('btnHighlightNeighbors') public btnHighlightNeighbors: MatButtonToggle;
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('timelineSlider') timelineSlider: TimelineSliderComponent;
  @ViewChild('btnSetTimeline') public btnSetTimeline: MatButton;

  @Output() initDone:EventEmitter<boolean> = new EventEmitter();
  todo$:Subject<any> = new Subject();
  
  constructor(
    private _cd: ChangeDetectorRef,
    private _dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _graph: AgensGraphService,
    private _sheet: MatBottomSheet
  ) { 
    this.colorsPallet = this._util.colors;
  }

  ngOnInit() {
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'additive',  // 'single' or 'additive'
        boxSelectionEnabled: true,  // if single then false, else true
        useCxtmenu: true,           // whether to use Context menu or not
        hideNodeTitle: true,        // hide nodes' title
        hideEdgeTitle: true,        // hide edges' title
    });
    this.divCanvas.nativeElement.style.cursor = 'pointer';   // Finger
  }

  ngOnDestroy(){
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);
      // change Detection by force
      this._cd.detectChanges();
    });
  }

  setData(dataGraph:IGraph){
    this.dataGraph = dataGraph;
    this.dataGraph.labels_size = dataGraph.labels.length;
    this.dataGraph.nodes_size = dataGraph.nodes.length;
    this.dataGraph.edges_size = dataGraph.edges.length;
    dataGraph.labels.forEach(x => {
      let eles = (x.type == 'nodes') 
                ? dataGraph.nodes.filter(y => y.data.label == x.name) 
                : dataGraph.edges.filter(y => y.data.label == x.name);
      x.size = eles.length;     // update eles size of label
    });
    // label 정렬 : node>edge 순으로, size 역순으로
    this.labels = [... _.orderBy(dataGraph.labels, ['type','size'], ['desc','desc'])];    
  }
  setMeta(metaGraph:IGraph){
    this.metaGraph = metaGraph;
  }

  onCanvasKeyup(event: KeyboardEvent) { 
    console.log( 'canvas keyUp:', event.key );
  }
  handleKeyboardEvent(event: KeyboardEvent) { 
    let charCode = String.fromCharCode(event.which).toLowerCase();
    if (this.canvasHover && event.ctrlKey) {
      console.log( 'keyPress: Ctrl + '+charCode, this.canvasHover );
      if( charCode == "z" ) this.cy.$api.unre.undo();
      else if( charCode == "y" ) this.cy.$api.unre.redo();
    }
  }

  /////////////////////////////////////////////////////////////////
  // Style Controllers
  /////////////////////////////////////////////////////////////////

  //////////////////////////////////////////////////////////
  //
  // 스타일 컨트롤러를 변경하면 진행되는 일
  //   1) nodes, edges 에 따라 아래 스타일 변경 
  //   2) meta class 로 style() 함수에서 스타일 변경
  //   3) scratch() 함수로 _style 에 저장 
  //   4) _style 값을 close()에서 data-graph, label, meta-graph 에 반영 

  // Style: Visibility
  onChangeStyleVisible(event){
    // console.log( 'onChangeStyleVisible:', event.checked );
    this.selectedLabel.scratch._style.visible = event.checked;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.visible = event.checked;
    });
    // node 라면 connectedEdge 들도 visible=false 가 되어야 함
    if( this.selectedLabel.type == 'nodes' ){
      targets.connectedEdges().forEach(x => {
        x._private.scratch._style.visible = event.checked;
      });
    }
    this.cy.style().update();
  }
  // Style: Color
  onChangeStyleColor(value:number){
    // console.log( 'onChangeStyleColor:', this.colorsPallet[value] );
    this.selectedLabel.scratch._style.color = this.colorsPallet[value];
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.color = _.cloneDeep(this.colorsPallet[value]);
    });
    this.cy.style().update();
  }
  // Style: Width
  onChangeStyleWidth(event){
    // console.log( 'onChangeStyleWidth:', event.value );    // number type
    this.selectedLabel.scratch._style.width = event.value;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.width = event.value;
    });
    this.cy.style().update();
  }
  // Style: Label ==> Find Label로 탐색 가능
  onChangeStyleTitle(event){
    // console.log( 'onChangeStyleTitle:', event.value );    // property.key
    this.selectedLabel.scratch._style.title = (event.value == '_null_') ? undefined : event.value;
    let targets = this.cy.elements(`${this.selectedLabel.type == 'nodes' ? 'node' : 'edge'}[label='${this.selectedLabel.name}']`);
    targets.forEach(x => {
      x._private.scratch._style.title = (event.value == '_null_') ? undefined : event.value;
    });
    this.cy.style().update();
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
    this.selectedLabel = undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    console.log('target:', target._private);
    // null 이 아니면 정보창 (infoBox) 출력
    if( this.btnStatus.shortestPath ) this.selectFindShortestPath(target);
    else if( this.btnStatus.neighbors ) this.highlightNeighbors(target);
    else{
      let allStatus = Object.keys(this.btnStatus).reduce( (prev,key) => { return  <boolean> prev || this.btnStatus[key] }, false );
      if( !allStatus ){
        this.selectedElement = target;
        // HighlightNeighbors 상태가 아닌 일반 상태라면 unselect
        this.cy.elements(':selected').unselect();
        // if( !this.btnHighlightNeighbors.checked ){}
      }
    }
  }  

  // qtipMenu 선택 이벤트
  cyQtipMenuCallback( target:any, value:string ){

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
    Object.keys(this.btnStatus).map( key => this.btnStatus[key] = false );
  }

  setGid( gid: number ){ 
    if( gid > 0 ) this.gid = gid; 
  }
  addLabel( label:ILabel ){ 
    let arr = this.labels.map(x => x.id);
    if( arr.indexOf(label.id) == -1 ) this.labels.push( label );  // not exists
    // else this.labels[ arr.indexOf(label.id) ] = label;
  }
  addNode( ele:INode ){ 
    let target = this.cy.getElementById(ele.data.id);
    if( target.empty() ) this.cy.add( ele );                      // not exists
    // else target.forEach(x => x._private.data = ele.data );
  }
  addEdge( ele:IEdge ){ 
    let target = this.cy.getElementById(ele.data.id);
    if( target.empty() ) this.cy.add( ele );                      // not exists
    // else target.forEach(x => x._private.data = ele.data );
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas( isTempGraph:boolean = false ){
    if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    this.cy.elements(':selected').unselect();
    
    this.isTempGraph = isTempGraph;
    this.cy.style(agens.graph.stylelist['dark']).update();

    // 완료 상태를 상위 graph.component 에 알려주기 (& layout 적용)
    this.initDone.emit(this.isVisible);
  }

  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){   
    this.cy.resize();
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
    agens.cy = this.cy;
  }

  adjustMenuOnNode(labels: Array<ILabel>, collection:any ){

  }

  clickGraphLabelChip( label:ILabel ): void {
    this.selectedElement = undefined;
    this.cy.elements(':selected').unselect();

    this.selectedLabel = label;
    setTimeout(()=>{
      let group = (label.type == 'edges') ? 'edge' : 'node';
      this.cy.elements(`${group}[label='${label.name}']`).select();
    }, 20);
  }

  savePositions(){
    // 저장할 꺼리가 있으면 저장 
    if( this.gid > 0 && this.cy.nodes().size() > 0 ) this._util.savePositions( this.cy );
  }

  graphPresetLayout(){
    // ///////////////////////////////////////////////////
    // **NOTE: 레이아웃 적용시 가끔 StackOverflow 발생
    //  ==> 문제 해결때 까지 주석처리함 (2018-09-18)
    //  ==> setTimeout 으로 layout() 을 감싸주니 괜찮음. 다시 해제함 (2018-09-27)

    if( this._util.hasPositions() ){
      this.toggleProgressBar(true);
      let remains:any[] = this._util.loadPositions(this.cy);

      let layoutOption = {
        name: 'random',
        fit: false, padding: 50, boundingBox: undefined, 
        nodeDimensionsIncludeLabels: true, randomize: false,
        animate: 'end', refresh: 30, animationDuration: 800, maxSimulationTime: 2800,
        ready: () => {}, stop: () => { this.cy.fit( this.cy.elements(), 50); this.toggleProgressBar(false); }
      };
      // rest random layout
      let elements = this.cy.nodes().filter(x => remains.includes(x.id()));           
      setTimeout(()=>{
        elements.layout(layoutOption).run();     
      }, 10);
    }
    else{
      this.graphChangeLayout('random');
    }
  }

  // cytoscape makeLayout & run
  graphChangeLayout(layout:string){
    this.toggleProgressBar(true);
    let targets = this.cy.elements(':selected');
    this.cy.$api.changeLayout(layout, {
      "padding": 50
      , "elements": (targets.size() > 2) ? targets : undefined
      , "ready": () => {}
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

  updateFilterTitle($event){
    const kwd = $event.target.value.toLowerCase();
    this.cy.$api.view.removeHighlights();

    // filter our data
    const elements = this.cy.nodes().filter(x => {
      const title = x.style('label');
      return title.toLowerCase().indexOf(kwd) > -1;
    });
    this.labelSearchCount = elements.size();
    // console.log('updateFilterLabel', kwd, elements);
    setTimeout(() => { if( !elements.empty() ) this.cy.$api.view.highlight( elements )}, 10);
  }

  toggleShowHideTitle(checked?:boolean): void{
    if( checked === undefined ) this.btnShowHideTitle.checked = !this.btnShowHideTitle.checked;
    else this.btnShowHideTitle.checked = checked;
    this.btnStatus.showHideTitle = this.btnShowHideTitle.checked;

    // 선택옵션 설정
    if( this.btnShowHideTitle.checked ){
      this.selectedOption = 'labelSearch';
      this.labelSearchCount = 0;
    } 
    else{
      this.selectedOption = undefined;
    } 

    // graph의 userZoomingEnabled 설정 변경
    this.cy.scratch('_config').hideNodeTitle = !this.btnShowHideTitle.checked;
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
    let edges = neighbors.edgesWith(neighbors); // inter-connected edges
    console.log( 'highlightNeighbors:', edges);
    this.cy.$api.view.highlight(edges);
    Promise.resolve(null).then(() => { 
      neighbors.select(); 
    });
  }

  /////////////////////////////////////////////////////////////////
  // FilterNGroupSheet
  /////////////////////////////////////////////////////////////////

  openFilterNGroupSheet(): void {
    // if( !this.metaGraph ) return;

    this.btnStatus.metaGraph = true;
    const bottomSheetRef = this._sheet.open(MetaGraphComponent, {
      ariaLabel: 'Meta Graph',
      panelClass: 'sheet-meta-graph',
      data: { "gid": this.gid, "labels": this.labels }
    });

    bottomSheetRef.afterDismissed().subscribe((x) => {
      this.btnStatus.metaGraph = false;
      agens.cy = this.cy;
      // 변경된 meta에 대해 data reload
      if( x && (x.hasOwnProperty('filters') && x.hasOwnProperty('groups'))
          && (Object.keys(x['filters']).length > 0 || Object.keys(x['groups']).length > 0) ) 
        this.runFilterByGroupBy(x);

      // change Detection by force
      this._cd.detectChanges();
    });
  }

  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  // _style의 width 데이터를 직접 수정, 원복시 _styleBak를 복사
  graphCentrality(option:string='degree'){ 
    // options: degree, pagerank, closeness, betweenness
    switch( option ){
      case 'degree': this._graph.centralrityDg( this.cy );      break;
      case 'pagerank': this._graph.centralrityPR( this.cy );    break;
      case 'closeness': this._graph.centralrityCn( this.cy );   break;
      case 'betweenness': this._graph.centralrityBt(this.cy ); break;
      default: 
        this.cy.elements().forEach(e => {
          e.scratch('_style', _.cloneDeep(e.scratch('_styleBak')));
        });
    }
    this.cy.style(agens.graph.stylelist['dark']).update();
  }

  clearFindShortestPath(){
    this.shortestPathOptions = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
    // cancel selected and highlights
    if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    this.cy.elements(':selected').unselect();

    this._cd.detectChanges();
  }

  toggleFindShortestPath(option:boolean=undefined){
    if( !option ) this.btnStatus.shortestPath = !this.btnStatus.shortestPath;
    else this.btnStatus.shortestPath = option;

    // enable 모드이면 options 리셋
    if( this.btnStatus.shortestPath ){
      this.shortestPathOptions = { sid: undefined, eid: undefined, directed: false, order: 0, distTo: undefined };
    }
    this._cd.detectChanges();
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

  toggleFindConnectedGroup(option:boolean=undefined){
    if( !option ) this.btnStatus.connectedGroup = !this.btnStatus.connectedGroup;
    else this.btnStatus.connectedGroup = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.connectedGroup ) {
      let groups:any[] = this.cy.elements(':visible').components();
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

  toggleFindCycles(option:boolean=undefined){
    if( !option ) this.btnStatus.findCycles = !this.btnStatus.findCycles;
    else this.btnStatus.findCycles = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.findCycles ) {
      this.grph_data = [];
      this._api.graph_findCycles(this.gid).subscribe(
        (x:IDoubleListDto) => {
          if( x.result ) this.grph_data = x.result;
          this._cd.detectChanges();
        }
      )
    }
    else {
      this.grph_data = [];
    }
  }

  onClickCyclePath(i){
    this.cy.elements(':selected').unselect();
    if( this.grph_data.length == 0 ) return;

    let sid:string = undefined;
    for( const vid of this.grph_data[i] ){
      this.cy.getElementById(vid).select();
      if( sid ){
        this.cy.edges(`[source='${sid}'][target='${vid}']`).select();
      }
      sid = String(vid);
    }
  }

  /////////////////////////////////////////////////////////////////
  // Toolbar : Timeline controlls
  /////////////////////////////////////////////////////////////////

  toggleTimeline(option:boolean=undefined){
    if( !option ) this.btnStatus.timeLine = !this.btnStatus.timeLine;
    else this.btnStatus.timeLine = option;

    // enable 모드이면 start_id, end_id 리셋
    if( this.btnStatus.timeLine ) {
      // this.timeline_data = this.cy.nodes().map((ele) => {
      //   return ele.data('prop').hasOwnProperty('date') ? ele.data('prop')['date'] : null;
      // }).filter(x => !!x);
      // this.timeline_data = ['2018-01-01', '2018-02-01', '2018-03-01', '2018-04-01', '2018-05-01', '2018-06-01'];
      // jQuery("#timelineSlider").ionRangeSlider();
      
      this.initTimeline();
      Promise.resolve(null).then(()=>{ 
        this._cd.detectChanges();
      });
    }
    else {
      this.timeline_data = [];
    }
  }

  initTimeline(){
    this.timelineDisabled = true;
    if( this.labels.length > 0 ){
      let property:IProperty = (this.labels[0].properties && this.labels[0].properties.length > 0) ?
              this.labels[0].properties[0] : undefined;
      this.timelineLabelCtl = new FormControl(this.labels[0], []);
      this.timelinePropertyCtl = new FormControl( property, [] );
      this.timelineSampleCtl = new FormControl( {value: 
        this.getTimelineSample( this.labels[0].name, property ), disabled: true}, [] );
    }
    else{
      this.timelineLabelCtl = new FormControl( {value: { name: "" }, disabled: true} , []);
      this.timelinePropertyCtl = new FormControl( {value: { key: "" }, disabled: true}, [] );
      this.timelineSampleCtl = new FormControl( {value: '', disabled: true}, [] );
    }
    this.timelineFormatCtl = new FormControl( "YYYY-MM-DD", []);
    
    this.timeline_data = [];
  }
  onChangeTimelineFormat(value){
    let sample = this.getTimelineSample(this.timelineLabelCtl.value.name, this.timelinePropertyCtl.value);
    if( sample != '' && moment(sample, value, true ).isValid() )
      this.timelineDisabled = false;
    else this.timelineDisabled = true;
    this._cd.detectChanges();
  }  
  onChangeTimelineProperty(event){
    // console.log( 'onChangeTimelineProperty:', event.value );
    if( event.value.type != 'STRING' ) this.timelineFormatCtl.disable({onlySelf:true});
    else this.timelineFormatCtl.enable({onlySelf:false});

    let sample = this.getTimelineSample(this.timelineLabelCtl.value.name, this.timelinePropertyCtl.value);
    this.timelineSampleCtl.setValue( sample, {emitEvent: false} );

    if( sample != '' && moment(sample, this.timelineFormatCtl.value, true ).isValid() )
      this.timelineDisabled = false;
    else this.timelineDisabled = true;
    this._cd.detectChanges();
  }
  getTimelineSample(labelName, propKey): string{
    if( !labelName || !propKey ) return '';

    let eles = this.cy.elements().filter(e => {
      return e.data('label') == labelName;
    });
    if( eles.nonempty() ){
      let data = eles.map(e => { 
        return (e.data('props').hasOwnProperty( propKey.key )) 
                ? e.data('props')[ propKey.key ] : null; 
        }).filter(v => v != null);
      if( data.length > 0 ) return <string> data[0];
    }
    return '';
  }
  setTimelineData(){
    this.timeline_data = this.cy.nodes().map(e => { 
      return (e.data('props').hasOwnProperty( this.timelinePropertyCtl.value.key )) 
              ? e.data('props')[ this.timelinePropertyCtl.value.key ] : null; 
      }).filter(v => v != null);
  }
  
  onControlTimelineSlider(event) {
    console.log("Slider control:", event);
    if( !event ) return;

    if( event == 'play' ){
      this.cy.elements(':selected').unselect();
      this.cy.elements().style('opacity',0.25);
    }
    else if( event == 'stop' ){
      this.cy.elements(':selected').unselect();
      this.cy.elements().style('opacity',1.0);
    }
  }
  onChangeTimelineSlider(event) {    
    if( !event ) return;

    let labelName = this.timelineLabelCtl.value.name;
    let propKey = this.timelinePropertyCtl.value.key;
    let targets = this.cy.elements().filter(e => {
      return e.data('label') == labelName && e.data('props').hasOwnProperty(propKey)
              && e.data('props')[propKey] == event;
    });
    this.cy.elements(':selected').unselect();
    targets.select();

    let visibleElements = this.cy.collection();
    targets.forEach(e => {
      visibleElements = visibleElements.union(e);
      visibleElements = visibleElements.union( e.neighborhood() );
      visibleElements = visibleElements.union( visibleElements.neighborhood() );
      visibleElements = visibleElements.union( visibleElements.edgesWith(visibleElements) );
    });
    visibleElements.style('opacity',1.0);
    // visibleElements.animate({ style: { 'visibility': 'visible' }, duration: 500 });
    let restElements = this.cy.elements().difference( visibleElements );
    restElements.style('opacity',0.25);
    // restElements.animate({ style: { 'visibility': 'hidden' }, duration: 200 });
  }
  onUpdateTimelineSlider(event) {
    console.log("Slider updated:", event);
    if( !event ) return;
  }
  setTimelineSliderValue( value ) {
    this.timelineSlider.update( value );
  }

  /////////////////////////////////////////////////////////////////
  // graph Toolbar button controlls
  /////////////////////////////////////////////////////////////////

  runFilterByGroupBy(options: any){

    this._util.savePositions( this.cy );  // hashMap<id,any> 에 position 저장
    this.clear(false);                    // false: clear canvas except labels    

    // call API
    let data$:Observable<any> = this._api.grph_filterNgroupBy(this.gid, options);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`graph_dto receiving : gid=${x.gid} (${this.gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.tempGraph = x;
        this.tempGraph.labels = new Array<ILabel>();
        this.tempGraph.nodes = new Array<INode>();
        this.tempGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        this.labels
        .filter(val => val.id == x.id)
        .map(label => {
          x.scratch['_style'] = _.cloneDeep( label.scratch['_style'] );
        });
        this.tempGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.labels
        .filter(val => val.type == 'nodes' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_neighbors'] += label.targets;
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      // x['position'] = this._util.getPositionById(x.data.id);
      this.tempGraph.nodes.push( x );
      this.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.tempGraph.edges.push( x );
      this.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.recountingLabels();
        this.initCanvas( true );
      });
  }
  
  // filterNgroup 등의 동작으로 element 개수가 달라진 경우 사용
  // ** NOTE: 바꿔치기 하지 말것!! (스타일 정보 등의 정합성 유지)
  recountingLabels(){
    this.labels.forEach(x => {
      let targets = (x.type == 'nodes') ? 
                    this.cy.nodes(`[label='${x.name}']`) : this.cy.edges(`[label='${x.name}']`);
      x.size = targets.length;
    });
  }

  reloadGraph(){
    if( this.gid < 0 ) return;
    this._util.savePositions( this.cy );        // hashMap<id,any> 에 position 저장

    this.clear(false);   // false: clear canvas except labels    

    // call API
    let data$:Observable<any> = this._api.grph_graph(this.gid);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`graph_dto receiving : gid=${x.gid} (${this.gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.dataGraph = x;
        this.dataGraph.labels = new Array<ILabel>();
        this.dataGraph.nodes = new Array<INode>();
        this.dataGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        this.labels
        .filter(val => val.id == x.id)
        .map(label => {
          x.scratch['_style'] = _.cloneDeep( label.scratch['_style'] );
        });
        this.dataGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
      // setNeighbors from this.resultGraph.labels;
      x.scratch['_neighbors'] = new Array<string>();
      this.labels
        .filter(val => val.type == 'nodes' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_neighbors'] += label.targets;
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      x['position'] = this._util.getPositionById(x.data.id);
      this.dataGraph.nodes.push( x );
      this.addNode( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data['label'])
        .map(label => {
          x.scratch['_style'] = label.scratch['_style'];
          x.scratch['_styleBak'] = label.scratch['_styleBak'];
        });
      this.dataGraph.edges.push( x );
      this.addEdge( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this.recountingLabels();
        this.initCanvas( false );
      });    
  }


}
