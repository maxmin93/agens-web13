import { Component, OnInit, NgZone, ViewChild, ElementRef, Input} from '@angular/core';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';
import { Label, Element, Node, Edge } from '../../../../models/agens-graph-types';

import * as CONFIG from '../../../../global.config';

import * as d3 from 'd3-selection';
import * as d3Scale from 'd3-scale';
import * as d3Array from 'd3-array';
import * as d3Axis from 'd3-axis';

declare var agens: any;

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss','../../graph.component.scss']
})
export class StatisticsComponent implements OnInit {

  isVisible: boolean = false;

  gid: number = undefined;
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
  
  constructor(
    private _ngZone: NgZone,    
    private dialog: MatDialog,
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { 
  }

  ngOnInit() {
    // prepare to call this.function from external javascript
    window['statGraphComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () =>{ if(this.isVisible) this.cyCanvasCallback() },
      cyElemCallback: (target) =>{ if(this.isVisible) this.cyElemCallback(target) },
      cyQtipMenuCallback: (target, value) =>{ if(this.isVisible) this.cyQtipMenuCallback(target, value) },
      component: this
    };
  }
  ngOnDestroy(){
    // 내부-외부 함수 공유 해제
    window['statGraphComponentRef'] = undefined;
  }

  ngAfterViewInit() {
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

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    this.selectedElement = undefined;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    console.log("stat-graph.elem-click:", target);

    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
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
    let graphProgressBar:any = document.querySelector('div#progressBarStatGraph');
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
    this.timeoutNodeEvent = undefined;
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
    // if( this.cy.$api.view ) this.cy.$api.view.removeHighlights();
    // this.cy.elements(':selected').unselect();
    // refresh style
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }
  // 액티브 상태가 될 때마다 실행되는 작업들
  refreshCanvas(){
    this.cy.resize();
    this.changeLayout( this.cy.elements() );
    agens.cy = this.cy;

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
  changeLayout( elements ){
    let options = { name: 'klay',
      nodeDimensionsIncludeLabels: false, fit: true, padding: 50,
      animate: false, transform: function( node, pos ){ return pos; },
      klay: {
        aspectRatio: 2.6, // The aimed aspect ratio of the drawing, that is the quotient of width by height
        borderSpacing: 60, // Minimal amount of space to be left to the border
        edgeRouting: 'POLYLINE', // Defines how edges are routed (POLYLINE, ORTHOGONAL, SPLINES)
        edgeSpacingFactor: 0.6, // Factor by which the object spacing is multiplied to arrive at the minimal spacing between edges.
        spacing: 60, // Overall setting for the minimal amount of space to be left between objects
        thoroughness: 6 // How much effort should be spent to produce a nice layout..
      }
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
