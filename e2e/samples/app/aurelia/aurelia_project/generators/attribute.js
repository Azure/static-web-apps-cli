import { inject } from "aurelia-dependency-injection";
import { Project, ProjectItem, CLIOptions, UI } from "aurelia-cli";

@inject(Project, CLIOptions, UI)
export default class AttributeGenerator {
  constructor(project, options, ui) {
    this.project = project;
    this.options = options;
    this.ui = ui;
  }

  async execute() {
    const name = await this.ui.ensureAnswer(this.options.args[0], "What would you like to call the custom attribute?");

    let fileName = this.project.makeFileName(name);
    let className = this.project.makeClassName(name);

    this.project.attributes.add(ProjectItem.text(`${fileName}.js`, this.generateSource(className)));

    await this.project.commitChanges();
    await this.ui.log(`Created ${fileName}.`);
  }

  generateSource(className) {
    return `import {inject} from 'aurelia-framework';

@inject(Element)
export class ${className}CustomAttribute {
  constructor(element) {
    this.element = element;
  }

  valueChanged(newValue, oldValue) {
    //
  }
}
`;
  }
}
