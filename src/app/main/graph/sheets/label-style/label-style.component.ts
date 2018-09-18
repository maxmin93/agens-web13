import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, Inject } from '@angular/core';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import { MatInputModule, MatSelectModule } from '@angular/material';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';

declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-label-style',
  templateUrl: './label-style.component.html',
  styleUrls: ['./label-style.component.scss']
})
export class LabelStyleComponent implements OnInit {

  isChanged: boolean = false;

  metaGraph: IGraph = undefined;
  // dataGraph: IGraph = undefined;
  // labels: Array<ILabel> = undefined;      // for Label chips

  cy: any = undefined;        // for Graph canvas

  selectedElement: any = undefined;   // selected element(node/edge)
  selectedStyle: IStyle = <IStyle>{
    visible: true, width: '50px', color: { "bc": '#939393', "dc": '#e3e3e3' }, title: 'name'
  };

  selectedProperties: any[] = [];     // properties of selected Label
  selectedTitle: string = 'null';
  selectedColorIndex: number = 0;
  selectedVisibility: string = 'visible'; // visibile or hidden

  colors: any[] = [];         // color Pallets  

  private nodeDefaultSizeRange: any = { min: 40, max: 100, step: 5, value: 50 };
  private edgeDefaultSizeRange: any = { min: 2, max: 12, step: 1, value: 2 };
  labelSizeRange: any = this.nodeDefaultSizeRange;
  
  labelNameCtl: FormControl;
  labelColorCtl: FormControl;
  labelSizeCtl: FormControl;

  // material elements
  @ViewChild('divCanvas', {read: ElementRef}) divCanvas: ElementRef;

  constructor(
    private _cd: ChangeDetectorRef,
    private _api: AgensDataService,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<LabelStyleComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: IGraph    
  ) { 
    this.metaGraph = (this.data) ? _.cloneDeep(this.data['metaGraph']) : undefined;
    this.colors = this._util.colors;
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

    this.labelNameCtl = new FormControl('_null_', []);
    this.labelColorCtl = new FormControl(this.selectedStyle.color['bc'], []);
    this.labelSizeCtl = new FormControl(this.getSize(this.selectedStyle.width), []);
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

    this.initLoad();
    this.setFormValues(this.selectedStyle);
  }

  initLoad(){
    this.metaGraph.nodes.forEach(e => { this.cy.add( e ); });
    this.metaGraph.edges.forEach(e => { this.cy.add( e ); });
    setTimeout(() => this.initCanvas(), 10);
  }

  close(): void {
    // 변경된 style 있으면 Labels, MetaGraph, DataGraph 에 적용
    if( this.isChanged ){
      this._util.copyStylesC2Label(this.cy.elements(), this.data['labels']);
      this._util.copyStylesC2MetaG(this.cy.elements(), this.data['metaGraph']);
      this._util.copyStylesC2DataG(this.cy.elements(), this.data['dataGraph']);
    }
    this._sheetRef.dismiss({ changed: this.isChanged });
    event.preventDefault();
  }

  /////////////////////////////////////////////////////////////////
  // Canvas Controllers
  /////////////////////////////////////////////////////////////////

  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
    // 선택 안된 상태에서 색상 등의 스타일을 변경하기 위해 주석 처리
    // this.selectedElement = undefined;
  }

  getSelectedStyle(ele: any){
    let value = <IStyle>{
      visible: true, width: (ele._private.group == 'nodes') ? '55px' : '2px'
      , color: this.colors[0], title: '_null_'
    };

    if( ele._private.scratch._style.title ) value.title = ele._private.scratch._style.title;
    if( ele._private.scratch._style.width ) value.width = ele._private.scratch._style.width;
    if( ele._private.scratch._style.hasOwnProperty('visible') && !ele._private.scratch._style.visible ) value.visible = false;
    if( ele._private.scratch._style.color ) value.color = ele._private.scratch._style.color;
    return value;
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(target:any):void {
    // null 이 아니면 정보창 (infoBox) 출력
    this.selectedElement = target;
    this.selectedStyle = this.getSelectedStyle(target);

    // element.type 에 따라 sizeRange 변경
    if( target._private.group == 'nodes' ) this.labelSizeRange = this.nodeDefaultSizeRange;
    else this.labelSizeRange = this.edgeDefaultSizeRange;
    // element와 일치하는 label에서 properties 가져오기
    let label = this.findLabel(target);
    if( label ) this.selectedProperties = label.properties.filter(x => x.type == 'STRING' || x.type == 'NUMBER');
    else this.selectedProperties = [];

    // 선택된 label에 대해 color, size, title 설정
    this.setFormValues( this.selectedStyle );
  }  

  // Neighbor Label 로의 확장
  cyQtipMenuCallback( target:any, value:string ){
    console.log( 'qtipMenuCallback:', target, value );
  }

  // for banana javascript, have to use 'document.querySelector(...)'
  toggleProgressBar(option:boolean = undefined){
    let graphProgressBar:any = document.querySelector('div#progressBarSheet');
    if( !graphProgressBar ) return;

    if( option === undefined ) option = !((graphProgressBar.style.visibility == 'visible') ? true : false);
    // toggle progressBar's visibility
    if( option ) graphProgressBar.style.visibility = 'visible';
    else graphProgressBar.style.visibility = 'hidden';
  } 

  /////////////////////////////////////////////////////////////////
  // Graph Controllers
  /////////////////////////////////////////////////////////////////

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 그래프 비우고
    this.cy.elements().remove();

    this.selectedElement = undefined;
    this.selectedStyle = undefined;
  }

  // 데이터 불러오고 최초 적용되는 작업들 
  initCanvas(){
    this.cy.resize();
    agens.cy = this.cy;

    this.changeLayout( this.cy.elements() );
    this.cy.style(agens.graph.stylelist['dark']).update();
    this.cy.fit( this.cy.elements(), 50);
  }

  refreshCanvas(){
    this.initCanvas();
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
  // Input Controllers
  /////////////////////////////////////////////////////////////////

  getColorIndex(selected:any):number {
    let target:number = 0;
    if( !selected ) return target;

    this.colors.forEach((x,idx) => {
      if(x['bc'] == selected['bc']){
        target = idx;
        return false;
      }
    });
    return target;
  }

  setFormValues(selected:IStyle){
    if( !selected ) return;
    
    // color
    if( selected.color ) this.selectedColorIndex = this.getColorIndex(selected.color);
    this.labelColorCtl.setValue( this.selectedColorIndex );

    // size
    if( selected.width ) this.labelSizeRange.value = this.getSize(selected.width);
    this.labelSizeCtl.setValue( this.labelSizeRange.value );

    // title
    this.selectedTitle = (selected.title) ? selected.title : '_null_';
    this.labelNameCtl.setValue( this.selectedTitle );
  }

  findLabel(element:any): ILabel {
    let target:ILabel = undefined;
    this.data['labels'].filter(x => x.type == element._private.group)
      .forEach(x => { 
        if( x.id == element.id() ){
          target = x;
          return false;
        }  
      });
    return target;
  }

  private getSize(value:string):number {
    if( !value ) return this.nodeDefaultSizeRange.value;
    if( value.indexOf('px') >= 0 ) value = value.substring(0,value.indexOf('px'));
    return new Number(value).valueOf();
  }

  //////////////////////////////////////////////////////////
  //
  // 스타일 컨트롤러를 변경하면 진행되는 일
  //   1) nodes, edges 에 따라 아래 스타일 변경 
  //   2) meta class 로 style() 함수에서 스타일 변경
  //   3) scratch() 함수로 _style 에 저장 
  //   4) _style 값을 close()에서 data-graph, label, meta-graph 에 반영 

  // opacity 로 반영 
  onChangeStyleVisible($event){
    // this.selectedStyle.visible = $event.value;   // [(ngModel)]로 연결
    this.selectedElement._private.scratch._style.visible = this.selectedStyle.visible;
    // visible=false 가 node 라면 connectedEdge 들도 visible=false 가 되어야 함
    if( !this.selectedStyle.visible && this.selectedElement._private.group == 'nodes' ){
      this.selectedElement.connectedEdges().forEach(x => {
        x._private.scratch._style.visible = false;
      });
    }
    this.cy.style().update();
    this.isChanged = true;
  }
  // 그대로 사용 가능
  onChangeStyleColor(value:number){
    if( !this.selectedStyle ) return;
    this.selectedStyle.color = this.colors[value];
    this.selectedElement._private.scratch._style.color = _.clone(this.selectedStyle.color);
    this.cy.style().update();
    this.isChanged = true;
  }
  // 그대로 사용 가능 
  onChangeStyleWidth($event){
    if( !this.selectedStyle ) return;
    this.selectedStyle.width = $event.value+'px';
    this.selectedElement._private.scratch._style.width = this.selectedStyle.width;
    this.cy.style().update();
    this.isChanged = true;
  }
  // label name + '/n(' + property.key + ')' 로 반영
  onChangeStyleTitle($event){
    if( !this.selectedStyle ) return;
    this.selectedStyle.title = $event.value;
    this.selectedElement._private.scratch._style.title = this.selectedStyle.title;
    this.cy.style().update();
    this.isChanged = true;
  }

  restoreStyles(){
    this.cy.elements().forEach( e => {
     if( e._private.scratch['_styleBak'] )
        e._private.scratch['_style'] = _.cloneDeep( e._private.scratch['_styleBak'] );
    });

    this.cy.style().update();
    this.isChanged = false;
  }

}
