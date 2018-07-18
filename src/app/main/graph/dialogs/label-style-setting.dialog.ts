import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';

import * as CONFIG from '../../../global.config';
import { ILabel, IProperty } from '../../../models/agens-data-types';

@Component({
  selector: 'app-label-style-setting-dialog',
  template: `
    <h2 mat-dialog-title>
      Label Style Setting<br/>
      <small>select Color or Size</small>
    </h2>
    <div mat-dialog-content>

      <form class="example-form" novalidate [formGroup]="labelForm">
      <div class="example-container">
       
        <mat-form-field class="example-full-width">
          <mat-select name="labelName" placeholder="Target label" [formControl]="labelNameCtl" (change)="onChangeLabelName($event)" required>
            <mat-option [value]="null">_NONE_</mat-option>
            <mat-option *ngFor="let label of labels" [value]="label.oid">{{ label.name }}</mat-option>
          </mat-select>
        </mat-form-field>
        
        <mat-form-field class="example-full-width">
          <mat-select name="labelTitle" placeholder="label Title" [formControl]="labelTitleCtl" required>
            <mat-option value="">_BLANK_</mat-option>
            <mat-option *ngFor="let key of labelKeys" [value]="key">{{ key }}</mat-option>
          </mat-select>
        </mat-form-field>
     
        <mat-form-field class="example-full-width">
          <mat-select name="labelColor" placeholder="label Color" [formControl]="labelColorCtl">
            <mat-option *ngFor="let color of labelColors" [value]="color" [style.background]="color">{{ color }}</mat-option>
          </mat-select>
        </mat-form-field>

        <h6>label Size : &nbsp;<span>{{labelSizeCtl.value}}</span>px</h6>
        <mat-slider name="labelSize" class="example-full-width" [formControl]="labelSizeCtl"
            [min]="labelSizeRange.min" [max]="labelSizeRange.max" [step]="labelSizeRange.step" [value]="labelSizeRange.value">
        </mat-slider>        
      </div>
      </form>

    </div>
    <div mat-dialog-actions>
      <button mat-button type="submit" class="btn btn-default" 
            (click)="onSubmit()" tabindex="2">Submit</button>
      <button mat-button (click)="onCancel()" tabindex="-1" class="btn">Cancel</button>
    </div>  
    `,
  styles: [`

    `]
})
export class LabelStyleSettingDialog implements OnInit {

  labelForm: FormGroup;
  labelNameCtl: FormControl;
  labelTitleCtl: FormControl;
  labelColorCtl: FormControl;
  labelSizeCtl: FormControl;

  private selectedLabel: ILabel = null;

  labels: Array<ILabel> = [];
  labelKeys: any[] = [];            // for labelTitle
  labelColors: any[] = [];          // for labelColor
  labelSizeRange: any = { min: 40, max: 100, step: 5, value: 50 };

  // default values
  private labelPallets: any[];
  private nodeDefaultSizeRange: any = { min: 40, max: 100, step: 5, value: 50 };
  private edgeDefaultSizeRange: any = { min: 2, max: 12, step: 1, value: 2 };

  constructor(
    public dialogRef: MatDialogRef<LabelStyleSettingDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { 
    this.labels = data.labels;
    this.labelPallets = data.labelPallets;
  }

  ngOnInit() {

    this.selectedLabel = this.labels[0];
    this.onChangeLabel(this.selectedLabel);

    this.labelNameCtl = new FormControl(this.selectedLabel.oid, []);

    let selectedTitle = this.selectedLabel['$$style']['label'];
    if( selectedTitle === null ) selectedTitle = '';
    this.labelTitleCtl = new FormControl(selectedTitle, []);
    
    this.labelColorCtl = new FormControl(this.selectedLabel['$$style']['color'], []);
    this.labelSizeCtl = new FormControl(this.getSize(this.selectedLabel['$$style']['size']), []);

    this.labelForm = new FormGroup({
      labelName: this.labelNameCtl,
      labelTitle: this.labelTitleCtl,
      labelColor: this.labelColorCtl,
      labelSize: this.labelSizeCtl
    });
  }  

  onSubmit(): void {
    let labelStyle:any = {
      target: this.labelNameCtl.value,
      title: this.labelTitleCtl.value,
      color: this.labelColorCtl.value,
      size: this.labelSizeCtl.value
    };

    // 이상 없으면 입력값 리턴
    if( labelStyle.target !== '' ) this.dialogRef.close(labelStyle);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onChangeLabelName(event){
    let target = this.labels.filter(function(val){ return val.oid === event.value; })[0];
    this.onChangeLabel(target);

    let selectedTitle = this.selectedLabel['$$style']['label'];
    if( selectedTitle === null ) selectedTitle = '';
    this.labelTitleCtl.setValue( selectedTitle );

    this.labelColorCtl.setValue( this.selectedLabel['$$style']['color'] );
    this.labelSizeRange.value = this.getSize(this.selectedLabel['$$style']['size']);
    this.labelSizeCtl.setValue( this.labelSizeRange.value );
    
    // console.log( this.labelNameCtl.value, '=>', this.labelTitleCtl.value, this.labelColorCtl.value, this.labelSizeCtl.value );    
  }

  private onChangeLabel(target:ILabel){
    this.selectedLabel = target;

    if( this.selectedLabel.type.valueOf() === 'NODE' ){
      this.labelColors = this.labelPallets;
      this.labelSizeRange = this.nodeDefaultSizeRange;
    }
    else{   // EDGE
      this.labelColors = this.labelPallets;
      this.labelSizeRange = this.edgeDefaultSizeRange;
    }
    this.labelKeys = this.selectedLabel.properties
        .filter(function(val){ return ['ID','NUMBER','STRING'].indexOf( val.type.valueOf() ) >= 0; })
        .map(function(val){ return val.key; });
  }

  private getSize(value:string):number {
    if( value.indexOf('px') >= 0 ) value = value.substring(0,value.indexOf('px'));
    return new Number(value).valueOf();
  }
}
