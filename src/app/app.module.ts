// import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Router
import { appRoutes, appRoutingProviders } from './app.routes';

// Google Analytics
import { Angulartics2Module } from 'angulartics2';
import { Angulartics2GoogleAnalytics } from 'angulartics2/ga';

// Material : 이거 하나면 하위 모듈들 모두 커버 되는듯..
import { CdkTableModule } from '@angular/cdk/table';
import {
  MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
  MatCardModule, MatCheckboxModule, MatChipsModule, MatDatepickerModule, MatDialogModule,
  MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule, MatInputModule,
  MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule, MatProgressBarModule,
  MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule, MatSidenavModule,
  MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule, MatStepperModule,
  MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, 
  MatTreeModule, MatFormFieldModule
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
// import { WindowRefService } from '../services/window-ref.service';

// // Dialogs
// import { ConfirmDeleteLabelDialog } from './main/dashboard/confirm-delete-label.dialog';
// import { CreateLabelInputDialog } from './main/dashboard/create-label-input.dialog';
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

    // ConfirmDeleteLabelDialog,
    // CreateLabelInputDialog,
    // LabelStyleSettingDialog,
    // ImageExportDialog,
    // ProjectOpenDialog,
    // ProjectSaveDialog,
    // SearchResultDialog
  ], 
  // directives, components, and pipes owned by this NgModule
  imports: [
    BrowserAnimationsModule,
    
    HttpClientModule,

    CdkTableModule,
    MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
    MatCardModule, MatCheckboxModule, MatChipsModule, MatStepperModule, MatDatepickerModule,
    MatDialogModule, MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule,
    MatInputModule, MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule,
    MatSidenavModule, MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule,
    MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, 
    MatTreeModule, MatFormFieldModule,
    
    NgxDatatableModule, 

    appRoutes,
    Angulartics2Module.forRoot([ Angulartics2GoogleAnalytics ]),

    PrettyJsonModule
  ], 
  // modules needed to run this module
  providers: [
    appRoutingProviders,
    Title,
    AuthGuardService,  
    AgensDataService,
    AgensUtilService
  ], 
  // additional providers needed for this module
  entryComponents: [ 
    // ConfirmDeleteLabelDialog,
    // CreateLabelInputDialog,
    // LabelStyleSettingDialog,
    // ImageExportDialog,
    // ProjectOpenDialog,
    // ProjectSaveDialog,
    // SearchResultDialog
  ],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
