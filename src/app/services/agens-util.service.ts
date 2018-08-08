import { Injectable } from '@angular/core';

import { IElement } from '../models/agens-data-types';

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

  public calcElementStyles(eles:Array<IElement>, fn:Function){
    let bins = this.makeBins( eles.map(x => x.data['size']) );
    eles.map( ele => {
      bins.forEach((x,idx) => {
        if( ele.data['size'] >= x.x0 && ele.data['size'] < x.x1 ){
          ele.scratch._style = {
            color: this.labelColors[ this.colorIndex%CONFIG.MAX_COLOR_SIZE ]
            , width: fn(idx) + 'px'
            , title: 'name'
          };
          this.colorIndex += 1;
          return false;
        }
      });
    });
  }

}
