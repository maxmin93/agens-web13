import { Injectable } from '@angular/core';

import { IGraph, IElement, ILabel } from '../models/agens-data-types';

import * as d3 from 'd3';
import * as CONFIG from '../app.config';

declare var _ : any;

@Injectable({
  providedIn: 'root'
})
export class AgensUtilService {

  // pallets : Node 와 Edge 라벨별 color 셋
  private colorIndex: number = 0;
  colors: any[] = colorPallets;

  private positions: Map<string,any> = new Map();

  constructor() { 
  }

  /////////////////////////////////////////////////////////////////
  // Common Utilities : Color Pallete
  /////////////////////////////////////////////////////////////////
  /*  
  // calculate color distance
  private calcColorDistance(preColor:string, newColor:string):number{
    let distance:number = 0.0;

    let preArray:string[] = preColor.substring(preColor.indexOf('(')+1,preColor.lastIndexOf(')')).split(',');
    let newArray:string[] = newColor.substring(newColor.indexOf('(')+1,newColor.lastIndexOf(')')).split(',');
    if( preArray.length > 0 && preArray.length === newArray.length ){
      for( let i=0; i<preArray.length; i+=1 ){
        distance += Math.pow(Number.parseFloat(preArray[i]) - Number.parseFloat(newArray[i]), 2);
      }
      distance = Math.sqrt(distance);
    }
    // console.log(`distance[ ${preColor}, ${newColor} ] = ${distance}`);
    return distance;
  }

  public randomColorGenerator(luminosity:string, size:number): any[]{
    // e.g. 'rgb(225,200,20)'
    let colors: any[] = [];
    let preColor = 'rgb(255,255,255)';
    for( let i=0; i<size; i+=1 ){      
      let maxDistanceColor = { distance: 0.0, color: '' };
      let currentColor = { distance: 0.0, color: '' };

      // Color 유사도 120 이하이면 maxLooping 이내에서 색상 다시 선택
      let currLoop = 0;
      do {
        currentColor.color = randomColor({ luminosity: luminosity, format: 'rgb' });
        // 이전 색상과의 거리 계산
        currentColor.distance = this.calcColorDistance(preColor, currentColor.color);
        if( maxDistanceColor.distance < currentColor.distance ){
          maxDistanceColor.distance = currentColor.distance;
          maxDistanceColor.color = currentColor.color;
        } 
        currLoop += 1;
      } while( maxDistanceColor.distance < 120 && currLoop < 30 );      // maxLooping = 30

      // 최대 거리의 색상으로 선정
      colors.push( maxDistanceColor.color );
      preColor = maxDistanceColor.color;      // 이전 색상 갱신
    }
    return colors;
  }
  */
 
  /////////////////////////////////////////////////////////////////
  // Common Utilities : Position WeakMap
  /////////////////////////////////////////////////////////////////
  
  hasPositions():boolean {
    return (this.positions && this.positions.size > 0) ? true : false;
  }

  resetPositions(){
    this.positions = undefined;
  }

  savePositions(cy:any){
    // 초기화
    if( !this.positions ) this.positions = new Map<string,any>();
    // save nodes' positions 
    let nodes = cy.nodes();
    nodes.forEach(x => {
      this.positions.set( x.id(), _.clone( x.position() ) );
    })
  }

  getPositionById(id:string):any{
    return this.positions.has(id) ? this.positions.get(id) : undefined;
  }

  // 존재하는 position 은 반영하고 없는 nodes 는 반환해서 random 처리
  loadPositions(cy:any):any[] {
    let remains: any[] = [];
    let nodes = cy.nodes();    
    nodes.forEach(x => {
      let pos = this.getPositionById( x.id() );
      if( pos ) {
        x.position( 'x', pos['x']);
        x.position( 'y', pos['y']);
      }
      else remains.push( x.id() );      // remains: position 이 없는 id 리스트
    });
    // this.resetPositions();              // 한번 쓰고 버린다
    return remains;
  }

  /////////////////////////////////////////////////////////////////
  // Common Utilities : Binning
  /////////////////////////////////////////////////////////////////
  
  // 구간화 
  // http://www.statisticshowto.com/choose-bin-sizes-statistics/
  // https://www.mathway.com/ko/popular-problems/Finite%20Math/621737
  // Sturges' formula
  public makeBinningBySturgesFormula(values:any[]):any[]{
    if( values.length == 0 ) return values;

    // get bin count
    let binSize = 1 + 3.322*Math.log10(values.length);
    // size ==> log10
    values.map(function(val){ val.sizeLog10 = Math.log10(val.size+1) });
    // get Max, Min ==> Gap of each bin
    let minVal = values.reduce(function(a,b){ if( a.sizeLog10 > b.sizeLog10) return b; else return a; }).sizeLog10;
    let maxVal = values.reduce(function(a,b){ if( a.sizeLog10 < b.sizeLog10) return b; else return a; }).sizeLog10;
    let binGap = Math.floor((maxVal - minVal)/binSize);
    // set Bin Number
    values.map(function(val){ val['$$bin'] = Math.floor((val.sizeLog10 - minVal)/binGap); });
    
    return values;
  }  

  private makeBins(data:number[]){
    let binCount = 10;
    let x = d3.scaleLinear().domain( d3.extent(data) ).nice( binCount );
    let histogram = d3.histogram().domain( d3.extent(x.domain()) ).thresholds( x.ticks(binCount) );
    return histogram( data );
  }

  // **NOTE: main의 schema graph와 graph의 meta graph가 함께 사용한다
  public calcElementStyles(eles:Array<IElement>, fn:Function, newColor:boolean=true){
    let bins = this.makeBins( eles.map(x => x.data['size']) );
    eles.map( ele => {
      bins.forEach( (x,idx) => {
        if( x.includes( ele.data['size'] ) ){
          // _style 객체가 새로 생성됨 (있으면 width만 갱신)
          if( ele.scratch.hasOwnProperty('_style') ){
            ele.scratch._style.width = fn(idx);
          }
          else{
            ele.scratch._style = {
              color: (newColor && ele.group == 'nodes') ? this.nextColor() : undefined
              , width: fn(idx)
              , title: 'name'
              , visible: true
            };
          }
          return false;
        }
      });
    });
  }

  public applyLabelStyle(eles:Array<IElement>, labels:Array<ILabel>, fn:Function): any{
    eles.forEach( ele => {
      labels.forEach( x => {
        if( fn(ele, x) ) {
          // if( ele.scratch.hasOwnProperty('_style') )
          //   ele.scratch._style.color = x.scratch._style.color;
          // else 
          ele.scratch._style = x.scratch._style;
          return false;
        }
      });
    });
  }

  // MetaGraph CyElements 에서 DataGraph IElement 로 Style 복사
  public copyStylesC2DataG(eles:any[], graph:IGraph){
    this.copyStylesC2GWidthFn( eles, graph.nodes, 
      (ele:any, x:IElement) => {
        return ele._private.data.name == x.data.label && ele._private.group == x.group;
      });    
    this.copyStylesC2GWidthFn( eles, graph.edges, 
      (ele:any, x:IElement) => {
        return ele._private.data.name == x.data.label && ele._private.group == x.group;
      });    
  }
  // MetaGraph CyElements 에서 MetaGraph IElement 로 Style 복사
  public copyStylesC2MetaG(eles:any[], graph:IGraph){
    this.copyStylesC2GWidthFn( eles, graph.nodes, 
      (ele:any, x:IElement) => {
        return ele._private.data.id == x.data.id && ele._private.group == x.group;
      });    
    this.copyStylesC2GWidthFn( eles, graph.edges, 
      (ele:any, x:IElement) => {
        return ele._private.data.id == x.data.id && ele._private.group == x.group;
      });    
  }
  private copyStylesC2GWidthFn(eles:any[], items:Array<IElement>, fn:Function){
    eles.forEach( ele => {
      items.forEach( x => {
        if( fn(ele, x) ) {
          x.scratch._style = ele._private.scratch._style;
          return false;
        }
      });
    });
  }

  // MetaGraph CyElements 에서 Labels ILabel 로 Style 복사
  public copyStylesC2Label(eles:any[], labels:Array<ILabel>){
    this.copyStylesC2LWidthFn( eles, labels, 
      (ele:any, x:ILabel) => {
        return ele._private.data.id == x.id && ele._private.group == x.type;
      });    
  }
  private copyStylesC2LWidthFn(eles:any[], labels:Array<ILabel>, fn:Function){
    eles.forEach( ele => {
      labels.forEach( x => {
        if( fn(ele, x) ) {
          x.scratch._style = ele._private.scratch._style;
          return false;
        }
      });
    });
  }

  public nextColor():any {
    this.colorIndex += 1;
    if( this.colorIndex >= colorPallets.length ) this.colorIndex = 1;
    return colorPallets[this.colorIndex];
  }
}

// { "bc": bg-color, "dc": border-color }
export const colorPallets:any[] = [
  { "bc": '#939393', "dc": '#e3e3e3'},   // #939393 | #e3e3e3   // gray: default edge color
  { "bc": '#20364b', "dc": '#0e2134'},   // #10263b | #0e2134
  { "bc": '#2f579d', "dc": '#1b3f84'},   // #1f478d | #1b3f84
  { "bc": '#1073c0', "dc": '#005aa8'},   // #0063b0 | #005aa8
  { "bc": '#7595d2', "dc": '#5c7bbb'},   // #6585c2 | #5c7bbb
  { "bc": '#2cb1ec', "dc": '#1898d7'},   // #1ca1dc | #1898d7
  { "bc": '#54b3eb', "dc": '#3d9ad6'},   // #44a3db | #3d9ad6
  { "bc": '#7fcef9', "dc": '#66b7e6'},   // #6fbee9 | #66b7e6
  { "bc": '#109ec6', "dc": '#0085ae'},   // #008eb6 | #0085ae
  { "bc": '#317487', "dc": '#1d5b6d'},   // #216477 | #1d5b6d
  { "bc": '#376269', "dc": '#224a50'},   // #275259 | #224a50
  { "bc": '#55644d', "dc": '#3d4c36'},   // #45543d | #3d4c36
  { "bc": '#316527', "dc": '#1d4c14'},   // #215517 | #1d4c14
  { "bc": '#5fac3a', "dc": '#479325'},   // #4f9c2a | #479325
  { "bc": '#9ac336', "dc": '#80ab21'},   // #8ab326 | #80ab21
  { "bc": '#ccea88', "dc": '#b5d56e'},   // #bcda78 | #b5d56e
  { "bc": '#bae5b7', "dc": '#a1d09e'},   // #aad5a7 | #a1d09e
  { "bc": '#a6dfb6', "dc": '#8dc99d'},   // #96cfa6 | #8dc99d
  { "bc": '#10a587', "dc": '#008c6d'},   // #009577 | #008c6d
  { "bc": '#107357', "dc": '#005a3f'},   // #006347 | #005a3f
  { "bc": '#5a847a', "dc": '#426b61'},   // #4a746a | #426b61
  { "bc": '#696a5a', "dc": '#505142'},   // #595a4a | #505142
  { "bc": '#8c8863', "dc": '#726e4b'},   // #7c7853 | #726e4b
  { "bc": '#b9b170', "dc": '#a09857'},   // #a9a160 | #a09857
  { "bc": '#bbb092', "dc": '#a39778'},   // #aba082 | #a39778
  { "bc": '#e9db9e', "dc": '#d4c585'},   // #d9cb8e | #d4c585
  { "bc": '#ffe071', "dc": '#eeca58'},   // #f0d061 | #eeca58
  { "bc": '#ffeb6f', "dc": '#fdd656'},   // #fddb5f | #fdd656
  { "bc": '#fff874', "dc": '#ffe55b'},   // #ffe864 | #ffe55b
  { "bc": '#ffd476', "dc": '#ffbd5d'},   // #ffc466 | #ffbd5d
  { "bc": '#f5c84b', "dc": '#f4b034'},   // #f5b83b | #f4b034
  { "bc": '#f66282', "dc": '#e34a69'},   // #e65272 | #e34a69
  { "bc": '#e72355', "dc": '#d2103d'},   // #d71345 | #d2103d
  { "bc": '#e13863', "dc": '#cb234b'},   // #d12853 | #cb234b
  { "bc": '#944564', "dc": '#7a2f4c'},   // #843554 | #7a2f4c
  { "bc": '#b75a55', "dc": '#9e423d'},   // #a74a45 | #9e423d
  { "bc": '#8e685b', "dc": '#744f43'},   // #7e584b | #744f43
  { "bc": '#d07852', "dc": '#b95f3b'},   // #c06842 | #b95f3b
  { "bc": '#f37c42', "dc": '#f1632c'},   // #f36c32 | #f1632c
  { "bc": '#f48b60', "dc": '#f27148'},   // #f47b50 | #f27148
  { "bc": '#f8a156', "dc": '#f7883e'},   // #f89146 | #f7883e
];