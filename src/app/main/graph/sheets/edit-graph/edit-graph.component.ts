import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, Inject, ChangeDetectorRef } from '@angular/core';

import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';

import { AgensDataService } from '../../../../services/agens-data.service';
import { AgensUtilService } from '../../../../services/agens-util.service';
import { IGraph, ILabel, IElement, INode, IEdge, IStyle } from '../../../../models/agens-data-types';

import { DatatableComponent } from '@swimlane/ngx-datatable';

declare var _: any;
declare var agens: any;

const new_value:string = '__new__';

@Component({
  selector: 'app-edit-graph',
  templateUrl: './edit-graph.component.html',
  styleUrls: ['./edit-graph.component.scss']
})
export class EditGraphComponent implements OnInit, AfterViewInit {
  
  changed: boolean = false;
  editLabelCtl: FormControl;

  gid: number = undefined;
  labels: ILabel[] = [];      // for Label chips
  element: any = undefined;   // cy.element.json()

  label: ILabel = undefined;
  properties: any[] = [];
  editing:any = {};

  @ViewChild('tblProperties') tblProperties: DatatableComponent;

  constructor(
    private _cd: ChangeDetectorRef,
    private _util: AgensUtilService,
    private _sheetRef: MatBottomSheetRef<EditGraphComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any
  ) { 
    if( data.hasOwnProperty('gid') ) this.gid = data['gid'];
    if( data.hasOwnProperty('labels') ) this.labels = data['labels'];
    if( data.hasOwnProperty('element') ) this.element = data['element'];
    // label 이 없는 new node or edge 라면 무조건 changed = true
    if( this.element && this.element.data.label == '' ) this.changed = true;
  }

  ngOnInit() {
    // init label input
    this.editLabelCtl = new FormControl(this.element.data.label, []);
    if( !this.changed ) this.editLabelCtl.disable();    // 기존 데이터라면 label 변경은 불가!!

    // init props' table 
    let targets = this.labels.filter(x => x.name == this.element.data.label && x.type == this.element.group );
    if( this.element.data.props ){
      this.properties = _.map( this.element.data.props, (v,k) => { 
        let t = 'STRING';
        if( targets.length > 0 ){
          let index = _.findIndex( targets[0].properties, {'key':k} );
          if( index >= 0 ) t = targets[0].properties[index].type;
        }
        // **NOTE: 기존(old) prop 데이터는 삭제하거나, value만 바꿀 수 있음!!
        //         반면에 신규(new) prop는 key, value, type 모두 수정 가능
        
        let value = v+'';     // string과 number, boolean 는 그냥 출력해야 함 
        if( t == 'ARRAY' || t=='OBJECT' ) value = JSON.stringify(v);
        return { "key":k, "value": value, "type": t, "state": 'old' };
      });
    }
  }

  ngAfterViewInit() {
  }

  close(): void {
    if( this.changed ){
      // label name => element.data.label
      this.element.data.label = this.editLabelCtl.value;
      // properties => element.data.props
      this.properties.forEach(x => {
        if( x.key && x.key != new_value && x.value && x.value != new_value ) 
          this.element.data.props[x.key] = x.value;
      });
    }

    this._sheetRef.dismiss( { changed: this.changed, element: this.element } );
    event.preventDefault();
  }

  /////////////////////////////////////////////////////////////////
  // Edit Properties
  /////////////////////////////////////////////////////////////////

  addNewProperty(){
    this.tblProperties.offset = 0;
    let temp = [...this.properties];
    temp.unshift( { "key": new_value, "value": new_value, "type": 'STRING', "state": 'new' } );
    this.properties = [...temp];     // 테이블 갱신
    Promise.resolve(null).then(()=>{
      this.editing['0-key'] = true;
      this.editing['0-value'] = true;
      this.editing['0-type'] = true;
    });
  }

  updateValue(event, cell, rowIndex) {
    this.editing[rowIndex + '-' + cell] = false;
    let value = event.target.value;
    if( cell == 'value' ){
      if( this.properties[rowIndex]['type'] == 'NUMBER' ) value = Number(value);
      else if( this.properties[rowIndex]['type'] == 'BOOLEAN' ) value = Boolean(value);
      else if( this.properties[rowIndex]['type'] == 'ARRAY' ) value = JSON.parse(value);
      else if( this.properties[rowIndex]['type'] == 'OBJECT' ) value = JSON.parse(value);
    }
    // 변경사항이 발생하면 changed on 설정
    if( this.properties[rowIndex][cell] != value ) this.changed = true;

    this.properties[rowIndex][cell] = value;    // 값 변경
    this.properties = [...this.properties];     // 테이블 갱신
  }  
}