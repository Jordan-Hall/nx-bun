# Creating a Conversion

Creating a conversion in our framework involves defining a conversion function and then exporting it as part of a `ConversionRegistry`. Here's how you can go about it:

## Conversion Function Signature

Your conversion function should adhere to the following signature:

```typescript
type ConverterType<T = any> = (tree: Tree, options: ConvertToBunGeneratorSchema, targetConfiguration: TargetConfiguration<T>) => void;
```

- `tree`: A data structure representing your project structure.
- `options`: The options object for your conversion, defined by `ConvertToBunGeneratorSchema`.
- `targetConfiguration`: The configuration for the target, with a generic type parameter `T`.

## Defining Your Conversion

Here's an example of a simple conversion function:

```typescript
const myConversion: ConverterType = (tree, options, targetConfiguration) => {
  // Your conversion logic here
};
```

## Exporting Your Conversion

After defining your conversion, you should export it as part of a `ConversionRegistry`. Here's how:

```typescript
export const myConversionRegistry: ConversionRegistry = {
  myExecutor: {
    myTarget: myConversion,
  },
};
```

- `myExecutor`: This is a placeholder for the executor string that corresponds to `TargetConfiguration.executor`.
- `myTarget`: This is a placeholder for the target string that corresponds to the keys in `ProjectConfiguration.targets`.

Make sure that your module is properly packaged and available for import by the framework.

## Further Help

If you need further assistance or have any questions regarding creating conversions, feel free to create an issue
