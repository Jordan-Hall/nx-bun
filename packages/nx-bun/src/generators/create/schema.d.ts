export type ProjectType = 'library' | 'application'

export interface CreateGeneratorSchema {
  name: string;
  template: string;
  type: ProjectType,
  directory?: string;
}
