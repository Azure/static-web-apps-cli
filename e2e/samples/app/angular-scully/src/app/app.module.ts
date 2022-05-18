import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { ScullyLibModule } from "@scullyio/ng-lib";

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, ScullyLibModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
