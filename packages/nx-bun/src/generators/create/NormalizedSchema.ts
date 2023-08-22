import { CreateGeneratorSchema } from "./schema";

export interface NormalizedSchema extends CreateGeneratorSchema {
  projectDirectory: string;
  projectName: string;
  projectRoot: string;
  layout: {
    appsDir: string;
    libsDir: string;
    standaloneAsDefault: boolean;
  }
}
