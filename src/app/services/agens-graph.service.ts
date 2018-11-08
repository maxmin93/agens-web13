import { Injectable } from '@angular/core';

import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { map, filter, concatAll, share } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto, ILabelDto, IResultDto, IGraphDto, IDoubleListDto, IPropStatDto } from '../models/agens-response-types';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IRecord, IColumn, IRow } from '../models/agens-data-types';
import { ILogs, IProject } from '../models/agens-manager-types';


@Injectable({
  providedIn: 'root'
})
export class AgensGraphService {

  constructor() { }

  /////////////////////////////////////////////////////////////////
  // Centrality methods
  /////////////////////////////////////////////////////////////////
  
  centralrityPR( cy:any ){
    let centrality = cy.elements(':visible').pageRank();
    cy.nodes().map(ele => {
      ele.scratch('_centralrityPr', centrality.rank(ele));
    });
    let acc = cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityPr') < acc[0] ) ? cur.scratch('_centralrityPr') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityPr') > acc[1] ) ? cur.scratch('_centralrityPr') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityPr') : acc[2] + cur.scratch('_centralrityPr');   // sum
        return acc;
      }, []);
    // console.log( 'pageRank Centrality: ', acc[0], acc[1], acc[2]/cy.nodes().size() );
    cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityPr') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value;
    });
    cy.style().update();
  }

  centralrityDg( cy:any ){
    let centrality = cy.elements(':visible').degreeCentralityNormalized();
    cy.nodes().map(ele => {
      ele.scratch('_centralrityDg', centrality.degree(ele));
    });
    let acc = cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityDg') < acc[0] ) ? cur.scratch('_centralrityDg') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityDg') > acc[1] ) ? cur.scratch('_centralrityDg') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityDg') : acc[2] + cur.scratch('_centralrityDg');   // sum
        return acc;
      }, []);
    // console.log( 'Degree Centrality: ', acc[0], acc[1], acc[2]/cy.nodes().size() );
    cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityDg') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value;
    });
    cy.style().update();
  }

  centralrityCn( cy:any ){
    let centrality = cy.elements(':visible').closenessCentralityNormalized();

    cy.nodes().map(ele => {
      ele.scratch('_centralrityCn', centrality.closeness(ele));
    });
    let acc = cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityCn') < acc[0] ) ? cur.scratch('_centralrityCn') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityCn') > acc[1] ) ? cur.scratch('_centralrityCn') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityCn') : acc[2] + cur.scratch('_centralrityCn');   // sum
        return acc;
      }, []);
    // console.log( 'Closeness Centrality:', acc[0], acc[1], acc[2]/cy.nodes().size() );
    cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityCn') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value;
    });
    cy.style().update();
  }
  
  centralrityBt( cy:any ){
    let centrality = cy.elements(':visible').betweennessCentrality();

    cy.nodes().map(ele => {
      ele.scratch('_centralrityBt', centrality.betweenness(ele));
    });
    let acc = cy.nodes().reduce((acc, cur) => {
        acc[0] = ( acc[0] === undefined || cur.scratch('_centralrityBt') < acc[0] ) ? cur.scratch('_centralrityBt') : acc[0];   // min
        acc[1] = ( acc[1] === undefined || cur.scratch('_centralrityBt') > acc[1] ) ? cur.scratch('_centralrityBt') : acc[1];   // max
        acc[2] = ( acc[2] === undefined ) ? cur.scratch('_centralrityBt') : acc[2] + cur.scratch('_centralrityBt');   // sum
        return acc;
      }, []);
    // console.log( 'Betweenness Centrality:', acc[0], acc[1], acc[2]/cy.nodes().size() );
    cy.nodes().map(ele => {
      let value = Math.floor( (ele.scratch('_centralrityBt') - acc[0])/( acc[1]-acc[0] )*100 ) + 20;
      ele.scratch('_style').width = value;
    });
    cy.style().update();
  }

  centralrityValue( cy:any, group: string, s:IPropStatDto){
    let targets = (group == 'nodes') 
                  ? cy.nodes().filter(x => x.data('label') == s.label && x.data('props').hasOwnProperty(s.prop))
                  : cy.edges().filter(x => x.data('label') == s.label && x.data('props').hasOwnProperty(s.prop));
    if( targets.size() == 0 ) return;

    // 기존값 모두 지우고
    cy.elements().forEach(x => x.removeScratch('_centralrityVu'));
    // targets 에 대해서만 frequency 값 저장
    targets.forEach(x => {
      if( s.type == 'NUMBER' ){
        s.rows.every(y => {
          if( Number(x.data('props')[s.prop]) <= Number(y.value) ){   // upper 보다 작으면
            x.scratch('_centralrityVu', Number(y.freq));
            return false;
          }
          return true;
        });
      }
      else if( s.type == 'STRING' || s.type == 'BOOLEAN' ){
        s.rows.every(y => {
          if( x.data('props')[s.prop] == y.value ){                   // value 가 같으면
            x.scratch('_centralrityVu', Number(y.freq));
            return false;
          }
          return true;
        });
      }
    });

    // width 반영
    cy.elements().forEach(ele => {
      if( !ele.scratch('_styleBak') ) return;
      if( ele.scratch('_centralrityVu') ){                            // value 가 있으면 반영
        if( group == 'nodes' )
          ele.scratch('_style').width = (Math.round(Math.log10( ele.scratch('_centralrityVu') ))*100/100) * 20 + 60 ;
        else       // edges
          ele.scratch('_style').width = (Math.round(Math.log10( ele.scratch('_centralrityVu') ))*100/100) * 6 + 8 ;
      }
      else ele.scratch('_style').width = ele.scratch('_styleBak').width;
    });
    cy.style().update();
  }
    
}
