import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IEnd } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';
import { IGraphDto } from '../../../../models/agens-response-types';

import * as d3 from 'd3-selection';
import * as d3Scale from 'd3-scale';
import * as d3Array from 'd3-array';
import * as d3Axis from 'd3-axis';

declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-stat-graph',
  templateUrl: './stat-graph.component.html',
  styleUrls: ['./stat-graph.component.scss','../../graph.component.scss']
})
export class StatGraphComponent implements OnInit {

  isVisible: boolean = false;

  gid: number = -1;
  statGraph:IGraph = undefined;
  
  cy: any = undefined;      // for Graph canvas
  labels: ILabel[] = [];    // for Label chips

  selectedElement: any = undefined;  
  timeoutNodeEvent: any = undefined;    // neighbors 선택시 select 추가를 위한 interval 목적

  ////////// d3 example //////////////
  private width: number;
  private height: number;
  private margin = {top: 0, right: 0, bottom: 0, left: 0};

  private x: any;
  private y: any;
  private svg: any;
  private g: any;

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;
  @ViewChild('divD3Chart', {read: ElementRef}) divD3Chart: ElementRef;
  
  @Output() initDone:EventEmitter<boolean> = new EventEmitter();
  todo$:Subject<any> = new Subject();

  constructor(
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
  }

  ngOnInit() {    
    // Cytoscape 생성
    this.cy = agens.graph.graphFactory(
      this.divCanvas.nativeElement, {
        selectionType: 'single',    // 'single' or 'additive'
        boxSelectionEnabled: false, // if single then false, else true
        useCxtmenu: true,           // whether to use Context menu or not
        hideNodeTitle: false,        // hide nodes' title
        hideEdgeTitle: false,        // hide edges' title
      });

  }

  ngOnDestroy(){
  }

  ngAfterViewInit() {
    this.cy.on('tap', (e) => { 
      if( e.target === this.cy ) this.cyCanvasCallback();
      else if( e.target.isNode() || e.target.isEdge() ) this.cyElemCallback(e.target);
    });

    // change Detection by force
    this._cd.detectChanges();
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
    console.log("statGraph.tap:", target._private);

    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
  }  

  // qtipMenu 선택 이벤트
  cyQtipMenuCallback( target:any, value:string ){

  }
  
  /////////////////////////////////////////////////////////////////
  // load meta graph for statistics
  /////////////////////////////////////////////////////////////////

  loadMetaGraph(gid: number){
    if( gid < 0 ) return;
    this.clear();

    // call API
    let data$:Observable<any> = this._api.grph_schema(gid);

    data$.pipe( filter(x => x['group'] == 'graph_dto') ).subscribe(
      (x:IGraphDto) => {
        console.log(`statGraph receiving : gid=${x.gid} (${gid})`);
      });
    data$.pipe( filter(x => x['group'] == 'graph') ).subscribe(
      (x:IGraph) => {
        this.statGraph = x;
        this.statGraph.labels = new Array<ILabel>();
        this.statGraph.nodes = new Array<INode>();
        this.statGraph.edges = new Array<IEdge>();    
      });
    data$.pipe( filter(x => x['group'] == 'labels') ).subscribe(
      (x:ILabel) => { 
        // meta-graph 에는 스타일을 부여하지 않는다 (nodes, edges 둘뿐이라)
        this.statGraph.labels.push( x );
      });
    data$.pipe( filter(x => x['group'] == 'nodes') ).subscribe(
      (x:INode) => {
        // setNeighbors from this.resultGraph.labels;
        x.classes = 'meta';     // meta class style
        x.scratch['_neighbors'] = new Array<string>();
        this.labels
          .filter(val => val.type == 'nodes' && val.name == x.data.props['name'])
          .map(label => {
            x.scratch['_neighbors'] += label.targets;
            x.scratch['_style'] = _.cloneDeep( label.scratch['_style'] );
          });
        this.statGraph.nodes.push( x );
        this.cy.add( x );
      });
    data$.pipe( filter(x => x['group'] == 'edges') ).subscribe(
      (x:IEdge) => {
        x.classes = 'meta';     // meta class style
        this.labels
        .filter(val => val.type == 'edges' && val.name == x.data.props['name'])
        .map(label => {
          x.scratch['_style'] = _.cloneDeep(label.scratch['_style']);
        });
        this.statGraph.edges.push( x );
        this.cy.add( x );
      });
    data$.pipe( filter(x => x['group'] == 'end') ).subscribe(
      (x:IEnd) => {
        this._util.calcElementStyles( this.statGraph.nodes, (x)=>40+x*5, false );
        this._util.calcElementStyles( this.statGraph.edges, (x)=>2+x, false );
        this.cy.style(agens.graph.stylelist['dark']).update();
        // **NOTE: delay 가 작으면 style(width)가 반영되기 전에 layout 이 완료되어 동일한 간격이 된다!
        setTimeout(() => {
          this.changeLayout( this.cy.elements(':visible') );
        }, 400);
        // this.initDone.emit(this.isVisible);
      });

  }

  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarStatGraph');
    if( !graphProgressBar ) return;
    
    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
    this._cd.detectChanges();
  } 

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 그래프 비우고
    this.cy.elements().remove();
    // 그래프 데이터 비우고
    this.statGraph = undefined;
    this.selectedElement = undefined;
    this.timeoutNodeEvent = undefined;

    // change Detection by force
    this._cd.detectChanges();
  }

  setGid( gid:number ){ this.gid = gid; }
  addLabel( label:ILabel ){ this.labels.push( label ); }
  // addNode( ele:INode ){ this.cy.add( ele ); }
  // addEdge( ele:IEdge ){ this.cy.add( ele ); }

  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    agens.cy = this.cy;

    // metaGraph 불러오기 by gid
    this.loadMetaGraph(this.gid);

    if( this.isVisible ){
      this.width = this.divD3Chart.nativeElement.offsetWidth;  //document.querySelector('div#div-d3-chart').offsetWidth;
      this.height = this.divD3Chart.nativeElement.offsetHeight;
      console.log( 'ngAfterViewInit():', this.width, this.height );

      this.initSvg();
      this.initAxis();
      this.drawAxis();
      this.drawBars();  
    }
  }

  runLayout(){
    this.changeLayout( this.cy.elements() );
  }

  private changeLayout( elements ){
    let options = { name: 'cose-bilkent',
      ready: function () {}, stop: function () {},
      nodeDimensionsIncludeLabels: false, refresh: 50, fit: true, padding: 50,
      randomize: true, nodeRepulsion: 4500, idealEdgeLength: 50, edgeElasticity: 0.45,
      nestingFactor: 0.1, gravity: 0.25, numIter: 2500, tile: true,
      animate: 'end', tilingPaddingVertical: 10, tilingPaddingHorizontal: 10,
      gravityRangeCompound: 1.5, gravityCompound: 1.0, gravityRange: 3.8,
      initialEnergyOnIncremental: 0.5    
    };
    // adjust layout
    elements.layout(options).run();
  }

  /////////////////////////////////////////////////////////////////
  // D3 Chart Controllers
  /////////////////////////////////////////////////////////////////

  private initSvg() {
    this.svg = d3.select('#svg-d3-chart');
    // this.width = +this.svg.attr('width') - this.margin.left - this.margin.right;
    // this.height = +this.svg.attr('height') - this.margin.top - this.margin.bottom;
    this.width = 600; //+this.svg.attr('width');
    this.height = 150;  //+this.svg.attr('height');

    console.log( 'initSvg():', this.svg, this.width, this.height );

    this.g = this.svg.append('g');
        //.attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');
  }

  private initAxis() {
      this.x = d3Scale.scaleBand().rangeRound([0, this.width]).padding(0.1);
      this.y = d3Scale.scaleLinear().rangeRound([this.height, 0]);
      this.x.domain(STATISTICS.map((d) => d.letter));
      this.y.domain([0, d3Array.max(STATISTICS, (d) => d.frequency)]);
  }

  private drawAxis() {
      this.g.append('g')
          .attr('class', 'axis axis--x')
          .attr('transform', 'translate(0,' + this.height + ')')
          .call(d3Axis.axisBottom(this.x));
      this.g.append('g')
          .attr('class', 'axis axis--y')
          .call(d3Axis.axisLeft(this.y).ticks(10, '%'))
          .append('text')
          .attr('class', 'axis-title')
          .attr('transform', 'rotate(-90)')
          .attr('y', 6)
          .attr('dy', '0.71em')
          .attr('text-anchor', 'end')
          .text('Frequency');
  }

  private drawBars() {
      this.g.selectAll('.bar')
          .data(STATISTICS)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', (d) => this.x(d.letter) )
          .attr('y', (d) => this.y(d.frequency) )
          .attr('width', this.x.bandwidth())
          .attr('height', (d) => this.height - this.y(d.frequency) );
  }

}

export interface Frequency {
  letter: string;
  frequency: number;
}

export const STATISTICS: Frequency[] = [
  {letter: 'A', frequency: .08167},
  {letter: 'B', frequency: .01492},
  {letter: 'C', frequency: .02782},
  {letter: 'D', frequency: .04253},
  {letter: 'E', frequency: .12702},
  {letter: 'F', frequency: .02288},
  {letter: 'G', frequency: .02015},
  {letter: 'H', frequency: .06094},
  {letter: 'I', frequency: .06966},
  {letter: 'J', frequency: .00153},
  {letter: 'K', frequency: .00772},
  {letter: 'L', frequency: .04025},
  {letter: 'M', frequency: .02406},
  {letter: 'N', frequency: .06749},
  {letter: 'O', frequency: .07507},
  {letter: 'P', frequency: .01929},
  {letter: 'Q', frequency: .00095},
  {letter: 'R', frequency: .05987},
  {letter: 'S', frequency: .06327},
  {letter: 'T', frequency: .09056},
  {letter: 'U', frequency: .02758},
  {letter: 'V', frequency: .00978},
  {letter: 'W', frequency: .02360},
  {letter: 'X', frequency: .00150},
  {letter: 'Y', frequency: .01974},
  {letter: 'Z', frequency: .00074}
];
