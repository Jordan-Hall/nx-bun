import { BundleExecutorSchema } from './schema';

export default async function runExecutor(options: BundleExecutorSchema) {
  console.log('Executor ran for Bundle', options);
  return {
    success: true,
  };
}
