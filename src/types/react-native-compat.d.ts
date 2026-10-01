import type * as React from 'react';

declare module 'react-native/types/public/ReactNativeTypes' {
  interface NativeMethods extends React.Component<any, any> {}
}

declare module 'react-native/Libraries/Animated/Animated' {
  namespace Animated {
    interface AnimatedComponent<T extends React.ComponentType<any>> {
      (
        props: React.PropsWithChildren<
          AnimatedProps<React.ComponentPropsWithRef<T>>
        > & {
          style?: any;
        }
      ): React.ReactNode;
    }
  }
}

declare module 'react-native/Libraries/Components/View/View' {
  interface View extends React.Component<ViewProps> {}
}

declare module 'react-native/Libraries/Text/Text' {
  interface Text extends React.Component<TextProps> {}
}

declare module 'react-native/Libraries/Components/ScrollView/ScrollView' {
  interface ScrollView extends React.Component<ScrollViewProps> {}
}

declare module 'react-native/Libraries/Components/TextInput/TextInput' {
  interface TextInput extends React.Component<TextInputProps> {}
}

declare module 'react-native/Libraries/Image/Image' {
  interface Image extends React.Component<ImageProps> {}
}

declare module 'react-native/Libraries/Components/Keyboard/KeyboardAvoidingView' {
  interface KeyboardAvoidingView extends React.Component<KeyboardAvoidingViewProps> {}
}

declare module 'react-native/Libraries/Modal/Modal' {
  interface Modal extends React.Component<ModalProps> {}
}

declare module 'react-native/Libraries/Components/ActivityIndicator/ActivityIndicator' {
  interface ActivityIndicator extends React.Component<ActivityIndicatorProps> {}
}

declare module 'react-native/Libraries/Components/RefreshControl/RefreshControl' {
  interface RefreshControl extends React.Component<RefreshControlProps> {}
}

declare module 'react-native/Libraries/Components/Switch/Switch' {
  interface Switch extends React.Component<SwitchProps> {}
}
