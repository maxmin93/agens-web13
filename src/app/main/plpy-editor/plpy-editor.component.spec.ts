import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlpyEditorComponent } from './plpy-editor.component';

describe('PlpyEditorComponent', () => {
  let component: PlpyEditorComponent;
  let fixture: ComponentFixture<PlpyEditorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlpyEditorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlpyEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
