import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, Inject, ChangeDetectorRef } from '@angular/core';

import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';

declare var _: any;
declare var agens: any;

@Component({
  selector: 'app-edit-graph',
  templateUrl: './edit-graph.component.html',
  styleUrls: ['./edit-graph.component.scss']
})
export class EditGraphComponent implements OnInit, AfterViewInit {
  
  editLabelCtl: FormControl;

  gid: number = undefined;
  labels: ILabel[] = [];      // for Label chips
  element: any = undefined;   // cy.element.json()

  label: ILabel = undefined;
  properties: any[] = [];
  editing:any = {};

  // material elements
  // @ViewChild('testEle', {read: ElementRef}) divPopup: ElementRef;

  constructor(
    private _cd: ChangeDetectorRef,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<EditGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any
  ) { 
    if( data.hasOwnProperty('gid') ) this.gid = data['gid'];
    if( data.hasOwnProperty('labels') ) this.labels = data['labels'];
    if( data.hasOwnProperty('element') ) this.element = data['element'];
    console.log( 'edit constructor:', this.gid, this.labels, this.element );
  }

  ngOnInit() {
    this.editLabelCtl = new FormControl(this.element.data.label, []);
    let targets = this.labels.filter(x => x.name == this.element.data.label && x.type == this.element.group );
    if( this.element.data.props ){
      this.properties = _.map( this.element.data.props, (v,k,i) => { 
        // k 에서 오류 ==> targets[0].properties[k]
        let t = (targets.length > 0) ? targets[0].properties[k].type : 'STRING';
        return { "key":k, "value": JSON.stringify(v), "type": t };
      });
    }
  }

  ngAfterViewInit() {
  }

  close(): void {
    this._sheetRef.dismiss();
    event.preventDefault();
  }

  /////////////////////////////////////////////////////////////////
  // Edit Properties
  /////////////////////////////////////////////////////////////////

  updateValue(event, cell, rowIndex) {
    console.log('inline editing rowIndex', rowIndex)
    this.editing[rowIndex + '-' + cell] = false;
    let value = event.target.value;
    if( cell == 'value' ){
      if( this.properties[rowIndex]['type'] == 'NUMBER' ) value = Number(value);
      else if( this.properties[rowIndex]['type'] == 'BOOLEAN' ) value = Boolean(value);
      else if( this.properties[rowIndex]['type'] == 'ARRAY' ) value = JSON.parse(value);
      else if( this.properties[rowIndex]['type'] == 'OBJECT' ) value = JSON.parse(value);
    }
    this.properties[rowIndex][cell] = value;
    this.properties = [...this.properties];
    console.log('UPDATED!', this.properties[rowIndex][cell]);
  }  
}