// import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Router
import { appRoutes, appRoutingProviders } from './app.routes';

// Material : 이거 하나면 하위 모듈들 모두 커버 되는듯..
import { CdkTableModule } from '@angular/cdk/table';
import {
  MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
  MatCardModule, MatCheckboxModule, MatChipsModule, MatDatepickerModule, MatDialogModule,
  MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule, MatInputModule,
  MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule, MatProgressBarModule,
  MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule, MatSidenavModule,
  MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule, MatStepperModule,
  MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, MatTreeModule
} from '@angular/material';

// UI Libraries
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';

// Components
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { GraphComponent } from './main/graph/graph.component';
import { HistoryComponent } from './main/history/history.component';

// Services
import { AuthGuardService } from './services/auth-guard.service';
import { AgensDataService } from './services/agens-data.service'
import { AgensUtilService } from './services/agens-util.service'
import { AgensGraphService } from './services/agens-graph.service';

// // Dialogs
import { ConfirmDeleteLabelDialog } from './main/dashboard/dialogs/confirm-delete-label.dialog';
import { InputCreateLabelDialog } from './main/dashboard/dialogs/input-create-label.dialog';
import { QueryResultComponent } from './main/graph/components/query-result/query-result.component';
import { QueryGraphComponent } from './main/graph/components/query-graph/query-graph.component';
import { QueryTableComponent } from './main/graph/components/query-table/query-table.component';
import { StatGraphComponent } from './main/graph/components/stat-graph/stat-graph.component';
import { MetaGraphComponent } from './main/graph/sheets/meta-graph/meta-graph.component';
import { CellViewerComponent } from './main/graph/sheets/cell-viewer/cell-viewer.component';
import { LabelStyleComponent } from './main/graph/sheets/label-style/label-style.component';
import { EditGraphComponent } from './main/graph/sheets/edit-graph/edit-graph.component';

// import { LabelStyleSettingDialog } from './main/graph/label-style-setting.dialog';
// import { ImageExportDialog } from './main/graph/image-export.dialog';
// import { ProjectOpenDialog } from './main/graph/project-open-dialog';
// import { ProjectSaveDialog } from './main/graph/project-save-dialog';
// import { SearchResultDialog } from './main/graph/search-result.dialog';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    DashboardComponent,
    LoginComponent,
    GraphComponent,
    HistoryComponent,

    ConfirmDeleteLabelDialog,
    InputCreateLabelDialog,

    QueryResultComponent,
    MetaGraphComponent,
    QueryGraphComponent,
    QueryTableComponent,
    CellViewerComponent,
    LabelStyleComponent,
    EditGraphComponent,
    StatGraphComponent,

    // LabelStyleSettingDialog,
    // ImageExportDialog,
    // ProjectOpenDialog,
    // ProjectSaveDialog,
    // SearchResultDialog
  ], 
  // directives, components, and pipes owned by this NgModule
  imports: [
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,

    HttpClientModule,

    CdkTableModule,
    MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
    MatCardModule, MatCheckboxModule, MatChipsModule, MatStepperModule, MatDatepickerModule,
    MatDialogModule, MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule,
    MatInputModule, MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule,
    MatSidenavModule, MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule,
    MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, MatTreeModule,
    
    NgxDatatableModule, 
    PrettyJsonModule,

    appRoutes
  ], 
  // modules needed to run this module
  providers: [
    appRoutingProviders,
    Title,
    AuthGuardService,
    AgensGraphService,  
    AgensDataService,
    AgensUtilService
  ], 
  // additional providers needed for this module
  entryComponents: [ 
    ConfirmDeleteLabelDialog,
    InputCreateLabelDialog,
    
    // LabelStyleSettingDialog,
    // ImageExportDialog,
    // ProjectOpenDialog,
    // ProjectSaveDialog,
    // SearchResultDialog

    LabelStyleComponent,
    MetaGraphComponent,
    CellViewerComponent,
    EditGraphComponent
  ],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
