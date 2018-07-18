import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';

import * as CONFIG from '../../../global.config';
import { ILabel, IProperty } from '../../../models/agens-data-types';

declare var agens: any;

@Component({
  selector: 'app-search-result-dialog',
  template: `
    <h2 mat-dialog-title>
      Search in Graph-result<br/>
      <small>type search-value with property</small>
    </h2>
    <div mat-dialog-content>

      <form class="example-form" novalidate [formGroup]="searchForm">
      <div class="example-container">
       
        <mat-form-field class="example-full-width">
          <mat-select name="selectLabel" placeholder="target Label" [formControl]="targetLabelCtl" (change)="onChangeLabel($event.value)" required>
            <mat-option *ngFor="let label of labels" [value]="label">{{ label.name }}</mat-option>
          </mat-select>
        </mat-form-field>
        
        <mat-form-field class="example-full-width">
          <mat-select name="selectProperty" placeholder="target Property" [formControl]="targetPropertyCtl" (change)="onChangeProperty($event.value)" required>
            <mat-option *ngFor="let property of labelProperties" [value]="property">{{ property.key }}</mat-option>
          </mat-select>
        </mat-form-field>
     
        <mat-form-field class="example-full-width">
          <mat-select name="selectOption" placeholder="search Option" [formControl]="searchOptionCtl">
            <mat-option *ngFor="let option of searchOptions" [value]="option">{{ option }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field class="example-full-width">
          <input matInput name="inputValue" placeholder="Search value" [formControl]="searchValueCtl" (keyup)="onChangeValue()">
          <button mat-button *ngIf="searchValueCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                (click)="searchValueCtl.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
        </mat-form-field>

      </div>
      </form>
      <p class="p__alarm"><span><i class="material-icons">info_outline</i><span>Search result count is</span></span><strong>{{ searchResult.size() | number }}</strong></p>

    </div>
    <div mat-dialog-actions>
      <button mat-button type="submit" class="btn btn-default" 
            (click)="onSubmit()" tabindex="2">Search</button>
      <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Cancel</button>
    </div>  
    `,
  styles: [`
    .p__alarm {
      background-color: #dc7ff5; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 1rem; 
      padding: .2rem .4rem; 
      border-radius: .225rem; 
      font-size: .815rem; 
      color: #fff; 
    }

    .p__alarm > span { 
      display: flex; 
      align-items: center; 
    }

    .p__alarm span i { 
      margin-right: .4rem; 
      font-size: 19px; 
    }

    .p__alarm strong { 
      font-size: .915rem; 
    }
    
    `]
})
export class SearchResultDialog implements OnInit {

  searchForm: FormGroup;
  targetLabelCtl: FormControl;
  targetPropertyCtl: FormControl;
  searchOptionCtl: FormControl;
  searchValueCtl: FormControl;

  selectedLabel: ILabel = null;
  selectedProperty: IProperty = null;
  searchResult: any = null;

  labels: Array<ILabel> = [];
  labelProperties: Array<IProperty> = [];            // for labelProperty
  searchOptions: any[] = ['none (empty)'];
  searchOptionsEmpty: any[] = ['none (empty)'];
  searchOptionsString: any[] = ['equal (string)', 'indexOf (string)'];
  searchOptionsNumber: any[] = ['equal (number)', 'moreThan (number)', 'lessThan (number)'];

  constructor(
    public dialogRef: MatDialogRef<SearchResultDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { 
    this.labels = data.labels;
  }

  ngOnInit() {
    this.searchResult = agens.cy.collection();

    let selectedLabel:ILabel = this.labels[0];
    let selectedProperty:IProperty = <IProperty> {key:'', type:'STRING', size:0};
    this.labelProperties = selectedLabel.properties.filter(function(val){ 
      return ['ID','NUMBER','STRING'].indexOf( val.type.valueOf() ) >= 0; 
    });
    if( this.labelProperties.length > 0 ){
      selectedProperty = this.labelProperties[0];
      if( selectedProperty.type.valueOf() === 'NUMBER' ) this.searchOptions = this.searchOptionsNumber;
      else this.searchOptions = this.searchOptionsString;
    } 
    else{
      this.searchOptions = this.searchOptionsEmpty;
    }

    this.targetLabelCtl = new FormControl(selectedLabel, []);
    this.targetPropertyCtl = new FormControl(selectedProperty, []);
    this.searchOptionCtl = new FormControl(this.searchOptions[0], []);
    this.searchValueCtl = new FormControl('', []);

    this.searchForm = new FormGroup({
      targetLabel: this.targetLabelCtl,
      targetProperty: this.targetPropertyCtl,
      searchOption: this.searchOptionCtl,
      searchValue: this.searchValueCtl
    });

    if( this.labelProperties.length > 0 ){
      this.searchOptionCtl.enable();
      this.searchValueCtl.enable();
    }
    else{
      this.searchOptionCtl.disable();
      this.searchValueCtl.disable();
    }
    this.onCheckSearch();
  }

  onSubmit(): void {
    let search:any = {
      label: <ILabel> this.targetLabelCtl.value,
      property: <IProperty> this.targetPropertyCtl.value,
      option: <any> this.searchOptionCtl.value,
      value: <any> this.searchValueCtl.value
    };

    // EDGE 가 검색된 경우 연결된 NODE 까지 포함 
    if( (<ILabel> this.targetLabelCtl.value).type.valueOf() === 'EDGE' ){
      this.searchResult.merge( this.searchResult.connectedNodes() );
    }
    // 이상 없으면 입력값 리턴
    if( this.searchResult !== null ) this.dialogRef.close(this.searchResult);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onChangeLabel(target:ILabel){
    this.selectedLabel = target;
    // console.log('onChangeLabel :', target);

    this.labelProperties = target.properties.filter(function(val){ 
      return ['ID','NUMBER','STRING'].indexOf( val.type.valueOf() ) >= 0; 
    });

    let selectedProperty:IProperty = <IProperty> {key:'', type:'STRING', size:0};
    this.labelProperties = target.properties.filter(function(val){ 
      return ['ID','NUMBER','STRING'].indexOf( val.type.valueOf() ) >= 0; 
    });
    if( this.labelProperties.length > 0 ){
      selectedProperty = this.labelProperties[0];
      if( selectedProperty.type.valueOf() === 'NUMBER' ) this.searchOptions = this.searchOptionsNumber;
      else this.searchOptions = this.searchOptionsString;
      this.searchOptionCtl.enable();
      this.searchValueCtl.enable();
    } 
    else{
      this.searchOptions = this.searchOptionsEmpty;
      this.searchOptionCtl.disable();
      this.searchValueCtl.disable();
    }

    this.targetPropertyCtl.setValue(selectedProperty);
    this.searchOptionCtl.setValue(this.searchOptions[0]);
    this.searchValueCtl.setValue('');
    
    this.onCheckSearch();
  }

  onChangeProperty(target:IProperty){
    this.selectedProperty = target;
    // console.log('onChangeProperty :', target);

    if( target.type.valueOf() === 'NUMBER' ) this.searchOptions = this.searchOptionsNumber;
    else this.searchOptions = this.searchOptionsString;

    this.searchOptionCtl.setValue(this.searchOptions[0]);
    this.searchValueCtl.setValue('');

    this.onCheckSearch();
  }
  
  onChangeValue(){
    // console.log('onChangeValue :', this.searchValueCtl.value);

    this.onCheckSearch();
  }

  onCheckSearch(){
    if( agens.cy === null ) return;

    let searchKey = (<IProperty> this.targetPropertyCtl.value).key;
    this.searchResult = agens.cy.elements().filter((i, elem) => {
        return elem.data('labels')[0] === (<ILabel> this.targetLabelCtl.value).name;
      });
    if( this.labelProperties.length > 0 ){
      this.searchResult = this.searchResult.filter((i, elem) => {
        return elem.data('props').hasOwnProperty(searchKey);
      });
    }
    else return;

    let searchValue = (<string> this.searchValueCtl.value).trim();
    if( searchValue === '' ) return;
    if( (<IProperty>this.targetPropertyCtl.value).type.valueOf() === 'NUMBER' ){
      if( (<string> this.searchOptionCtl.value).startsWith('equal') )
        this.searchResult = this.searchResult.filter((i, elem) => {
          return elem.data('props')[searchKey] === (+searchValue);
        });
      else if( (<string> this.searchOptionCtl.value).startsWith('moreThan') )
        this.searchResult = this.searchResult.filter((i, elem) => {
          return elem.data('props')[searchKey] >= (+searchValue);
        });
      else if( (<string> this.searchOptionCtl.value).startsWith('lessThan') )
        this.searchResult = this.searchResult.filter((i, elem) => {
          return elem.data('props')[searchKey] <= (+searchValue);
        });
    }
    else{
      searchValue = searchValue.toLowerCase();
      if( (<string> this.searchOptionCtl.value).startsWith('equal') )
        this.searchResult = this.searchResult.filter((i, elem) => {
          return elem.data('props')[searchKey].toLowerCase() === searchValue;
        });
      else if( (<string> this.searchOptionCtl.value).startsWith('indexOf') )
        this.searchResult = this.searchResult.filter((i, elem) => {
          return elem.data('props')[searchKey].toLowerCase().indexOf(searchValue) >= 0;
        });
    }
    // console.log('searchResult2.length =', this.searchResult.size(), this.searchResult);
  }

}
