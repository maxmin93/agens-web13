import { Component, OnInit, Inject } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';

@Component({
  selector: 'app-cell-viewer',
  templateUrl: './cell-viewer.component.html',
  styleUrls: ['./cell-viewer.component.scss']
})
export class CellViewerComponent implements OnInit {

  cellValue: any = null;

  constructor(
    private _sheetRef: MatBottomSheetRef<CellViewerComponent>,
    @Inject(MAT_BOTTOM_SHEET_DATA) public data: any    
  ) { 
    this.cellValue = (this.data) ? this.data : null;
  }

  ngOnInit() {
    // console.log( 'cellViewer:', this.data );
  }

  close(): void {
    this._sheetRef.dismiss();
    event.preventDefault();
  }

  // 클립보드에 복사하기
  copyCellValue(){
    let $temp:any = document.querySelector("<input>");
    (<any>document.querySelector("body")).append($temp);
    $temp.val( (<any>document.querySelector("#cellValue")).text() ).select();
    document.execCommand("copy");
    // console.log('copyCellValue :', $("#cellValue").text());
    $temp.remove();
  }

}
