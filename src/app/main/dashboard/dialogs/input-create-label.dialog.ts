import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import * as CONFIG from '../../../app.config';
import { ILabel, IProperty } from '../../../models/agens-data-types';

const EMPTY_LABEL: ILabel = { 
  group: 'labels', id: '', type: '', name: '', owner: '', desc: '', size: 0
  , properties: [], sources: [], targets: [], scratch: { size_not_empty: 0, is_dirty: true }
};

@Component({
  selector: 'app-input-create-label-dialog',
  template: `
    <h4>NEW-LABEL <strong>INPUT</strong></h4>
    <p class="subtext">Create type informations for New-Label.</p>
    <div mat-dialog-content>      
      <form novalidate [formGroup]="labelForm" class="margin">
        <mat-form-field class="block">
          <mat-select name="labelType" [formControl]="labelTypeCtl" placeholder="Label Type" required>
            <mat-option *ngFor="let type of labelTypes" [value]="type">{{ type }}</mat-option>
          </mat-select>
        </mat-form-field>
        
        <mat-form-field class="block">
          <input matInput name="labelName" [formControl]="labelNameCtl" placeholder="Name" required>
          <button mat-button *ngIf="labelNameCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                (click)="labelNameCtl.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
          <mat-error *ngIf="labelNameCtl.hasError('pattern') && !labelNameCtl.hasError('required')">
            Name has to <strong>start [a-zA-Z] char and length is 3~30</strong>
          </mat-error>
          <div style="color:red;" *ngIf="isDuplicated && !labelNameCtl.dirty">
            <p>Please enter other name (same name is already been)(2)</p>
          </div>
          <mat-error *ngIf="labelNameCtl.hasError('required')">
            Name is <strong>required</strong>
          </mat-error>
        </mat-form-field>

        <mat-form-field class="block">
          <input matInput [formControl]="labelDescCtl" placeholder="DESC">
          <button mat-button *ngIf="labelDescCtl.value" matSuffix mat-icon-button aria-label="Clear" 
                  (click)="labelDescCtl.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
          <mat-error *ngIf="labelDescCtl.hasError('maxlength')">
            Desc is <strong>too long</strong>. (max={{MAX_LABEL_DESC_SIZE}})
          </mat-error>
        </mat-form-field>
      </form>
    </div>
    <div mat-dialog-actions>
      <button mat-button (click)="onCancel()" tabindex="-1" class="btn">CANCEL</button>  
      <button mat-button type="submit" class="btn btn-default" 
          [disabled]="!labelForm.valid" (click)="onSubmit()" tabindex="2">SUBMIT</button>
      
    </div>  
    `,
  styles: [`

    `]
})
export class InputCreateLabelDialog implements OnInit {

  labelForm: FormGroup;
  labelTypeCtl: FormControl;
  labelNameCtl: FormControl;
  labelDescCtl: FormControl;

  labelTypes: string[] = [ 'NODE', 'EDGE' ];
  MAX_LABEL_DESC_SIZE: number = 500;

  isDuplicated: boolean = false;

  newLabel: ILabel = EMPTY_LABEL;

  constructor(
    public dialogRef: MatDialogRef<InputCreateLabelDialog>,
    @Inject(MAT_DIALOG_DATA) public data: Array<ILabel>
  ) { 
  }

  ngOnInit() {

    this.labelTypeCtl = new FormControl('NODE', [ 
      Validators.pattern("(NODE|EDGE)") 
    ]);
    this.labelNameCtl = new FormControl('', [ 
      Validators.required, Validators.pattern(/^[a-zA-Z]{1}[a-zA-Z0-9_]{2,29}$/)
    ]);
    this.labelDescCtl = new FormControl('', [Validators.maxLength(this.MAX_LABEL_DESC_SIZE)]);

    this.labelForm = new FormGroup({
      labelType: this.labelTypeCtl,
      labelName: this.labelNameCtl,
      labelDesc: this.labelDescCtl
    });

  }  

  onSubmit(): void {
    this.newLabel.type = this.labelTypeCtl.value;
    // Name 중복검사
    for( let label of this.data ){
      if( label.name === this.labelNameCtl.value ){
        this.labelNameCtl.setValue('');
        this.labelNameCtl.reset();
        this.isDuplicated = true;
        return;
      }
    }
    this.newLabel.name = this.labelNameCtl.value;
    this.newLabel.desc = this.labelDescCtl.value;

    // 이상 없으면 입력값 리턴
    if( this.newLabel.name !== '' && this.newLabel.type !== '' )
      this.dialogRef.close(this.newLabel);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

}
