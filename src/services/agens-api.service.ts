import { Injectable } from '@angular/core';
// import { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';

import * as CONFIG from '../global.config';

import { IClientDto, ISchemaDto } from '../models/agens-dto-types'

declare var randomColor: any;

@Injectable()
export class AgensApiService {

  public api: any = {
    CORE: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_CORE_API}`,
    MNGR: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_MNGR_API}`,
    AUTH: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_AUTH_API}`
  };

  public product:string = "Welcome to AgensBrowser";
  
  private titleSource = new BehaviorSubject<string>(this.product);
  currentTitle = this.titleSource.asObservable();

  private menuSource = new BehaviorSubject<string>("main");
  currentMenu = this.menuSource.asObservable();
  
  public client:IClientDto = null;  // ssid, user_name, user_ip, timestamp, valid
  public meta:ISchemaDto = null;      // graph, labels, meta
  
  constructor () {
    if( CONFIG.DEV_MODE ){
      this.api = {
        CORE: 'http://127.0.0.1:8085/'+CONFIG.AGENS_CORE_API,
        MNGR: 'http://127.0.0.1:8085/'+CONFIG.AGENS_MNGR_API,
        AUTH: 'http://127.0.0.1:8085/'+CONFIG.AGENS_AUTH_API,
      };
    }

    if( localStorage.getItem('agens-product') ) this.product = localStorage.getItem('agens-product');
    this.titleSource = new BehaviorSubject<string>(this.product);
    this.currentTitle = this.titleSource.asObservable();
  }

  changeTitle(title: string) {
    this.titleSource.next(title);
  }
  changeMenu(menu: string) {
    this.menuSource.next(menu);
  }

  /////////////////////////////////////////////////////////////////
  // Common Utilities
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

}
