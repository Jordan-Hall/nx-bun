export interface AppGeneratorSchema {
  name: string;
  applicationType?: AppTypes;
  directory?: string;
  tags?: string;
}
export type AppTypes = 'api' | 'none';