import { Injectable } from '@angular/core';

import { IElement, ILabel } from '../models/agens-data-types';

import * as d3 from 'd3';
import * as CONFIG from '../global.config';

declare var randomColor: any;

@Injectable({
  providedIn: 'root'
})
export class AgensUtilService {

  // pallets : Node 와 Edge 라벨별 color 셋
  colorIndex: number = 0;
  labelColors: any[] = [];
  
  constructor() { 
    // pallets 생성 : luminosity='dark'
    this.labelColors = this.randomColorGenerator('dark', CONFIG.MAX_COLOR_SIZE);
  }

  /////////////////////////////////////////////////////////////////
  // Common Utilities : Color Pallete
  /////////////////////////////////////////////////////////////////
  
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

  public calcElementStyles(eles:Array<IElement>, fn:Function, newColor:boolean=true){
    let bins = this.makeBins( eles.map(x => x.data['size']) );
    eles.map( ele => {
      bins.forEach( (x,idx) => {
        if( x.includes( ele.data['size'] ) ){
          ele.scratch._style = {
            color: (newColor && ele.group == 'nodes') ? this.nextColor() : undefined
            , width: fn(idx) + 'px'
            , title: 'name'
          };          
          if( newColor ) this.colorIndex += 1;
          return false;
        }
      });
    });
  }

  public applyLabelColor(eles:Array<IElement>, labels:Array<ILabel>, fn:Function): any{
    eles.forEach( ele => {
      labels.forEach( x => {
        if( fn(ele, x) ) {
          if( ele.scratch.hasOwnProperty('_style') )
            ele.scratch._style.color = x.scratch._style.color;
          else ele.scratch._style = x.scratch._style;
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
  { "bc": '#939393', "dc": '#e3e3e3'},  // gray: default edge color
  { "bc": '#10263b', "dc": '#0e2134'}, 
  { "bc": '#1f478d', "dc": '#1b3f84'}, 
  { "bc": '#0063b0', "dc": '#005aa8'}, 
  { "bc": '#6585c2', "dc": '#5c7bbb'}, 
  { "bc": '#1ca1dc', "dc": '#1898d7'}, 
  { "bc": '#44a3db', "dc": '#3d9ad6'}, 
  { "bc": '#6fbee9', "dc": '#66b7e6'}, 
  { "bc": '#008eb6', "dc": '#0085ae'}, 
  { "bc": '#216477', "dc": '#1d5b6d'}, 
  { "bc": '#275259', "dc": '#224a50'}, 
  { "bc": '#45543d', "dc": '#3d4c36'}, 
  { "bc": '#215517', "dc": '#1d4c14'}, 
  { "bc": '#4f9c2a', "dc": '#479325'}, 
  { "bc": '#8ab326', "dc": '#80ab21'}, 
  { "bc": '#bcda78', "dc": '#b5d56e'}, 
  { "bc": '#aad5a7', "dc": '#a1d09e'}, 
  { "bc": '#96cfa6', "dc": '#8dc99d'}, 
  { "bc": '#009577', "dc": '#008c6d'}, 
  { "bc": '#006347', "dc": '#005a3f'}, 
  { "bc": '#4a746a', "dc": '#426b61'}, 
  { "bc": '#595a4a', "dc": '#505142'}, 
  { "bc": '#7c7853', "dc": '#726e4b'}, 
  { "bc": '#a9a160', "dc": '#a09857'}, 
  { "bc": '#aba082', "dc": '#a39778'}, 
  { "bc": '#d9cb8e', "dc": '#d4c585'}, 
  { "bc": '#f0d061', "dc": '#eeca58'}, 
  { "bc": '#fddb5f', "dc": '#fdd656'}, 
  { "bc": '#ffe864', "dc": '#ffe55b'}, 
  { "bc": '#ffc466', "dc": '#ffbd5d'}, 
  { "bc": '#f5b83b', "dc": '#f4b034'}, 
  { "bc": '#e65272', "dc": '#e34a69'}, 
  { "bc": '#d71345', "dc": '#d2103d'}, 
  { "bc": '#d12853', "dc": '#cb234b'}, 
  { "bc": '#843554', "dc": '#7a2f4c'}, 
  { "bc": '#a74a45', "dc": '#9e423d'}, 
  { "bc": '#7e584b', "dc": '#744f43'}, 
  { "bc": '#c06842', "dc": '#b95f3b'}, 
  { "bc": '#f36c32', "dc": '#f1632c'}, 
  { "bc": '#f47b50', "dc": '#f27148'}, 
  { "bc": '#f89146', "dc": '#f7883e'}, 
];