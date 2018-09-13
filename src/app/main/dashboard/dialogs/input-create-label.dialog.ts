import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import * as CONFIG from '../../../app.config';
import { ILabel, IProperty } from '../../../models/agens-data-types';

const EMPTY_LABEL: ILabel = { 
  group: 'labels', id: '', type: '', name: '', owner: '', desc: '', size: 0
  , properties: [], sources: [], targets: [], scratch: { is_dirty: true }
};

@Component({
  selector: 'app-input-create-label-dialog',
  template: `
    <h4>NEW-LABEL <strong>INPUT</strong></h4>
    <span class="subtitle p-no m-10">Create type informations for New-Label.</span>
    <div class="col">      
      <form novalidate [formGroup]="labelForm" class="strech col m-10">
        <mat-form-field class="m-20">
          <mat-select class="strech" name="labelType" [formControl]="labelTypeCtl" placeholder="Label Type" required>
            <mat-option *ngFor="let type of labelTypes" [value]="type">{{ type }}</mat-option>
          </mat-select>
        </mat-form-field>
        
        <mat-form-field>
          <input matInput class="strech" name="labelName" [formControl]="labelNameCtl" placeholder="Name" required>
          <button *ngIf="labelNameCtl.value" matSuffix aria-label="Clear" 
                (click)="labelNameCtl.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
          <mat-error *ngIf="labelNameCtl.hasError('pattern') && !labelNameCtl.hasError('required')">
            Name has to <strong>start [a-zA-Z] char and length is 3 ~ 30</strong>
          </mat-error>
          <div style="color:red;" *ngIf="isDuplicated && !labelNameCtl.dirty">
            <p>Please enter other name (same name is already been)(2)</p>
          </div>
          <mat-error *ngIf="labelNameCtl.hasError('required')">
            Name is <strong>required</strong>
          </mat-error>
        </mat-form-field>

        <mat-form-field>
          <input matInput [formControl]="labelDescCtl" placeholder="DESC">
          <button *ngIf="labelDescCtl.value" matSuffix aria-label="Clear" 
                  (click)="labelDescCtl.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
          <mat-error *ngIf="labelDescCtl.hasError('maxlength')">
            Desc is <strong>too long</strong>. (max={{MAX_LABEL_DESC_SIZE}})
          </mat-error>
        </mat-form-field>
      </form>
    </div>
    <div class="m-10 row-end">
      <button mat-button type="submit"  
          [disabled]="!labelForm.valid" (click)="onSubmit()" tabindex="2">SUBMIT</button>
      <button mat-button (click)="onCancel()" tabindex="-1" >CANCEL</button>  
      
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
