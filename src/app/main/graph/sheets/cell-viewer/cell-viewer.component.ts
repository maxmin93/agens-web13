import { Component, OnInit, Inject } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material';

import { IGraph, ILabel, IElement, INode, IEdge } from '../../../../models/agens-data-types';

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
    this.cellValue = (this.data) ? this.reform(this.data) : null;
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
    let $temp:any = document.createElement('textarea');
    $temp.style.position = 'fixed';
    $temp.style.left = '0';
    $temp.style.top = '0';
    $temp.style.opacity = '0';
    $temp.value = JSON.stringify( this.cellValue );

    document.body.appendChild($temp);
    $temp.focus();
    $temp.select();
    document.execCommand("copy");
    document.body.removeChild($temp);
  }

  reform(data:any):any {
    let value = data.value;
    switch( data.type ){
      case 'GRAPH': value = { 
            "nodes": (<IGraph>data.value).nodes.map((x:INode) => x.data ), 
            "edges": (<IGraph>data.value).edges.map((x:IEdge) => x.data )
          }; break;
      case 'NODE': value = (<INode>data.value).data; break;
      case 'EDGE': value = (<IEdge>data.value).data; break;
    }
    return value;
  }

}
