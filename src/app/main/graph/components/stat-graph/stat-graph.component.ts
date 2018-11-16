import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MatDialog, MatButtonToggle } from '@angular/material';

import { Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { DatatableComponent } from '@swimlane/ngx-datatable';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IProperty, INode, IEdge, IStyle, IEnd } from '../../../../models/agens-data-types';
import { IGraphDto } from '../../../../models/agens-response-types';

import * as CONFIG from '../../../../app.config';
import * as _ from 'lodash';
import * as moment from 'moment';

declare var agens: any;
declare var d3: any;

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

  // 출력: 테이블 label의 properties
  selectedLabel: ILabel = undefined;
  selectedProperties: IProperty[] = [];
  tablePropertiesRows: IProperty[] = [];
  tablePropertiesColumns : any[] = [
    { name: 'KEY', prop: 'key' },
    { name: 'TYPE', prop: 'type' },
    { name: 'Size', prop: 'size' },
  ];
  
  propDescStat: any = { kurt: 0.0, max: 0.0, mean: 0.0, median: 0.0, min: 0.0, n: 0, skew: 0.0, stdev: 0.0, type: 'unknown' };
  propFrequency: any[];

  // ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
  @ViewChild('tableProperties') tableProperties: DatatableComponent;

  ////////// d3 example //////////////
  private width: number;
  private height: number;
  private margin = {top: 5, right: 20, bottom: 5, left: 20};

  private x: any;
  private y: any;
  private svg: any = undefined;
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
    // console.log("statGraph.tap:", target._private);

    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
    let temp = this.labels.filter(x => x.id == target.id() && x.type == target.group() );
    this.selectedLabel = temp.length > 0 ? temp[0] : undefined;

    // 테이블 초기화: 선택 label의 properties 주입
    this.selectedProperties = [];
    this.tablePropertiesRows = this.selectedLabel ? [...this.selectedLabel.properties] : [];
    this.tableProperties.offset = 0;

    this.propDescStat = { kurt: 0.0, max: 0.0, mean: 0.0, median: 0.0, min: 0.0, n: 0, skew: 0.0, stdev: 0.0, type: 'unknown' };
    this.propFrequency = [];
  }  

  // qtipMenu 선택 이벤트
  cyQtipMenuCallback( target:any, value:string ){

  }

  /////////////////////////////////////////////////////////////////
  // table for properties
  /////////////////////////////////////////////////////////////////

  onSelectProperty({ selected }) {
    if( this.gid < 0 || !this.selectedLabel || !selected || selected.length == 0 ) return;   

    this._api.grph_propStat(this.gid, this.selectedLabel.type, this.selectedLabel.name, selected[0]['key'])
    .subscribe(
      x => {
        // console.log('propStat: ', x);
        if( x.state == 'SUCCESS' ){
          if( x.stat ){
            this.propDescStat = x.stat;
            this.propDescStat['type'] = x.type.toLowerCase();
          } 
          if( x.rows ){
            // **NOTE: maximum length = 50. If over then slice array.
            let rows = (x.rows.length > 50) ? x.rows.slice(0,50) : x.rows;
            this.drawD3Chart( x.type, rows );
          } 
        }
        else{
          this.propDescStat = { kurt: 0.0, max: 0.0, mean: 0.0, median: 0.0, min: 0.0, n: 0, skew: 0.0, stdev: 0.0, type: 'unknown' };
          this.propFrequency = [];
          this.initSvg();
        }
      }
    );
  }

  drawD3Chart(type, rows){    
      this.width = +this.divD3Chart.nativeElement.offsetWidth - this.margin.left - this.margin.right;
      this.height = +this.divD3Chart.nativeElement.offsetHeight - this.margin.top - this.margin.bottom;

      if( this.svg ) this.svg.remove();
      this.svg = d3.select('#div-d3-chart').append('svg')
                    .style("width", (this.divD3Chart.nativeElement.offsetWidth+40) + 'px')
                    .style("height", (this.divD3Chart.nativeElement.offsetHeight+40) + 'px');
      this.g = this.svg.append('g')
                    .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

      this.x = d3.scaleBand().rangeRound([0, this.width]).padding(0.1);
      this.y = d3.scaleLinear().rangeRound([this.height, 0]);
      this.x.domain(rows.map((d) => d.value));
      this.y.domain([0, d3.max(rows, (d) => Number(d['freq']))]);

      let tool_tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-8, 0])
        .html(function(d) {
          let title = (type == 'STRING' || type == 'BOOLEAN') ? '"'+d.value+'"' : ('"~'+d.value).substring(0,8)+'"';
          return "<strong> "+title+"</strong>=<span style='color:red'>" + d.freq + "</span>";
        });
      this.svg.call(tool_tip);

      this.g.append('g')
          .attr('class', 'axis axis--x')
          .attr('transform', 'translate(0,' + this.height + ')')
          .call(d3.axisBottom(this.x));
      this.g.append('g')
          .attr('class', 'axis axis--y')
          .call(d3.axisLeft(this.y).ticks(10, '%'))
          .append('text')
          .attr('class', 'axis-title')
          .attr('transform', 'rotate(-90)')
          .attr('y', 6)
          .attr('dy', '0.71em')
          .attr('text-anchor', 'end')
          .text('Frequency');

      this.g.selectAll('.bar')
          .data(rows)
          .enter().append('rect')
          .attr('class', 'bar')
          .attr('x', (d) => this.x(d.value) )
          .attr('y', (d) => this.y(Number(d.freq)) )
          .attr('width', this.x.bandwidth())
          .attr('height', (d) => this.height - this.y(Number(d.freq)) )
          .on('mouseover', tool_tip.show)
          .on('mouseout', tool_tip.hide);
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
        // console.log(`statGraph receiving : gid=${x.gid} (${gid})`);
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
        }, 10);
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
  clear( option:boolean = false ){
    // 그래프 비우고
    this.cy.elements().remove();

    // 그래프 데이터 비우고
    if( option ){ this.gid = -1; }
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
      this.initSvg();
    }
  }

  runLayout(){
    this.changeLayout( this.cy.elements() );
  }

  private changeLayout( elements ){
    let animation_enabled = localStorage.getItem(CONFIG.ANIMATION_ENABLED_KEY);
    let options = { name: 'cose-bilkent',
      ready: function () {}, stop: function () {},
      nodeDimensionsIncludeLabels: false, refresh: 50, fit: true, padding: 50,
      randomize: true, nodeRepulsion: 4500, idealEdgeLength: 50, edgeElasticity: 0.45,
      nestingFactor: 0.1, gravity: 0.25, numIter: 2500, tile: true,
      animate: animation_enabled == 'true' ? 'end' : false, 
      tilingPaddingVertical: 10, tilingPaddingHorizontal: 10,
      gravityRangeCompound: 1.5, gravityCompound: 1.0, gravityRange: 3.8,
      initialEnergyOnIncremental: 0.5    
    };
    // adjust layout
    elements.layout(options).run();
  }

  /////////////////////////////////////////////////////////////////
  // D3 Chart Controllers
  // ** 참고
  // https://bl.ocks.org/caravinden/d04238c4c9770020ff6867ee92c7dac1
  /////////////////////////////////////////////////////////////////

  private initSvg() {
    if( this.svg ) this.svg.remove();
    this.width = +this.divD3Chart.nativeElement.offsetWidth - this.margin.left - this.margin.right;
    this.height = +this.divD3Chart.nativeElement.offsetHeight - this.margin.top - this.margin.bottom;

    this.svg = d3.select('#div-d3-chart').append('svg')
              .style("width", this.width + 'px')
              .style("height", this.height + 'px');
    this.g = this.svg.append('g')
              .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    
    this.x = d3.scaleBand().rangeRound([0, this.width]).padding(0.1);
    this.y = d3.scaleLinear().rangeRound([this.height, 0]);
    this.x.domain([]);
    this.y.domain([0, 100]);
  }
  
}

export interface Frequency {
  letter: string;
  frequency: number;
}

export const STATISTICS: Frequency[] = [
  {letter: 'A1', frequency: .08167},
  {letter: 'B1', frequency: .01492},
  {letter: 'C1', frequency: .02782},
  {letter: 'D1', frequency: .04253},
  {letter: 'E1', frequency: .12702},
  {letter: 'F1', frequency: .02288},
  {letter: 'G1', frequency: .02015},
  {letter: 'H1', frequency: .06094},
  {letter: 'I1', frequency: .06966},
  {letter: 'J1', frequency: .00153},
  {letter: 'K1', frequency: .00772},
  {letter: 'L1', frequency: .04025},
  {letter: 'M1', frequency: .02406},
  {letter: 'N1', frequency: .06749},
  {letter: 'O1', frequency: .07507},
  {letter: 'P1', frequency: .01929},
  {letter: 'Q1', frequency: .00095},
  {letter: 'R1', frequency: .05987},
  {letter: 'S1', frequency: .06327},
  {letter: 'T1', frequency: .09056},
  {letter: 'U1', frequency: .02758},
  {letter: 'V1', frequency: .00978},
  {letter: 'W1', frequency: .02360},
  {letter: 'X1', frequency: .00150},
  {letter: 'Y1', frequency: .01974},
  {letter: 'A2', frequency: .08167},
  {letter: 'B2', frequency: .01492},
  {letter: 'C2', frequency: .02782},
  {letter: 'D2', frequency: .04253},
  {letter: 'E2', frequency: .12702},
  {letter: 'F2', frequency: .02288},
  {letter: 'G2', frequency: .02015},
  {letter: 'H2', frequency: .06094},
  {letter: 'I2', frequency: .06966},
  {letter: 'J2', frequency: .00153},
  {letter: 'K2', frequency: .00772},
  {letter: 'L2', frequency: .04025},
  {letter: 'M2', frequency: .02406},
  {letter: 'N2', frequency: .06749},
  {letter: 'O2', frequency: .07507},
  {letter: 'P2', frequency: .01929},
  {letter: 'Q2', frequency: .00095},
  {letter: 'R2', frequency: .05987},
  {letter: 'S2', frequency: .06327},
  {letter: 'T2', frequency: .09056},
  {letter: 'U2', frequency: .02758},
  {letter: 'V2', frequency: .00978},
  {letter: 'W2', frequency: .02360},
  {letter: 'X2', frequency: .00150},
  {letter: 'Y2', frequency: .01974},
  // size=50
];
