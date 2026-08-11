import { DefaultTheme, LinkingOptions, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { AppThemeProvider } from "./src/context/ThemeContext";
import { fontAssets, fonts } from "./src/fonts";
import { useAppTheme } from "./src/hooks/useAppTheme";
import * as network from "./src/offline/network";
import * as syncEngine from "./src/offline/syncEngine";
import { Theme } from "./src/theme";
import { CyclesStackParamList, GoalsStackParamList, MoreStackParamList, PillarsStackParamList, TasksStackParamList } from "./src/navigation/types";
import CycleDetailScreen from "./src/screens/cycles/CycleDetailScreen";
import CycleFormScreen from "./src/screens/cycles/CycleFormScreen";
import CyclesListScreen from "./src/screens/cycles/CyclesListScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import GoalDetailScreen from "./src/screens/goals/GoalDetailScreen";
import GoalFormScreen from "./src/screens/goals/GoalFormScreen";
import GoalsListScreen from "./src/screens/goals/GoalsListScreen";
import LoginScreen from "./src/screens/LoginScreen";
import LogScreen from "./src/screens/LogScreen";
import MoreScreen from "./src/screens/MoreScreen";
import PillarDetailScreen from "./src/screens/pillars/PillarDetailScreen";
import PillarFormScreen from "./src/screens/pillars/PillarFormScreen";
import PillarsListScreen from "./src/screens/pillars/PillarsListScreen";
import TaskFormScreen from "./src/screens/TaskFormScreen";
import TasksScreen from "./src/screens/TasksScreen";

// Lets the home-screen widgets deep-link straight into a specific screen instead of
// just opening the app to its last screen: the task widget's "add task" button, and
// the log widget's card (both use OPEN_URI clickActions).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linking: LinkingOptions<any> = {
  prefixes: ["grindconsole://"],
  config: {
    screens: {
      Tasks: {
        screens: {
          TasksList: "tasks",
          TaskForm: "tasks/new",
        },
      },
      Log: "log",
    },
  },
};

const Tab = createBottomTabNavigator();
const GoalsStack = createNativeStackNavigator<GoalsStackParamList>();
const CyclesStack = createNativeStackNavigator<CyclesStackParamList>();
const PillarsStack = createNativeStackNavigator<PillarsStackParamList>();
const TasksStack = createNativeStackNavigator<TasksStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList & { GoalsStack: undefined; CyclesStack: undefined; PillarsStack: undefined }>();

const TAB_ICONS: Record<string, string> = {
  Tasks: "📋",
  Log: "📝",
  More: "•••",
};

function GoalsStackNavigator() {
  return (
    <GoalsStack.Navigator screenOptions={{ headerShown: true }}>
      <GoalsStack.Screen name="GoalsList" component={GoalsListScreen} options={{ headerShown: false }} />
      <GoalsStack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: "Goal" }} />
      <GoalsStack.Screen name="GoalForm" component={GoalFormScreen} options={{ title: "" }} />
    </GoalsStack.Navigator>
  );
}

function CyclesStackNavigator() {
  return (
    <CyclesStack.Navigator screenOptions={{ headerShown: true }}>
      <CyclesStack.Screen name="CyclesList" component={CyclesListScreen} options={{ headerShown: false }} />
      <CyclesStack.Screen name="CycleDetail" component={CycleDetailScreen} options={{ title: "Cycle" }} />
      <CyclesStack.Screen name="CycleForm" component={CycleFormScreen} options={{ title: "" }} />
    </CyclesStack.Navigator>
  );
}

function PillarsStackNavigator() {
  return (
    <PillarsStack.Navigator screenOptions={{ headerShown: true }}>
      <PillarsStack.Screen name="PillarsList" component={PillarsListScreen} options={{ headerShown: false }} />
      <PillarsStack.Screen name="PillarDetail" component={PillarDetailScreen} options={{ title: "Pillar" }} />
      <PillarsStack.Screen name="PillarForm" component={PillarFormScreen} options={{ title: "" }} />
    </PillarsStack.Navigator>
  );
}

function TasksStackNavigator() {
  return (
    <TasksStack.Navigator screenOptions={{ headerShown: false }}>
      <TasksStack.Screen name="TasksList" component={TasksScreen} />
      <TasksStack.Screen name="TaskForm" component={TaskFormScreen} options={{ headerShown: true, title: "" }} />
    </TasksStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: true }}>
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ headerShown: false }} />
      <MoreStack.Screen name="GoalsStack" component={GoalsStackNavigator} options={{ headerShown: false, title: "Goals" }} />
      <MoreStack.Screen name="CyclesStack" component={CyclesStackNavigator} options={{ headerShown: false, title: "Cycles" }} />
      <MoreStack.Screen name="PillarsStack" component={PillarsStackNavigator} options={{ headerShown: false, title: "Pillars" }} />
      <MoreStack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, title: "Dashboard" }} />
    </MoreStack.Navigator>
  );
}

function AppTabs() {
  const theme = useAppTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subtext,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
        tabBarIcon: ({ color }) => <TabIcon label={TAB_ICONS[route.name]} color={color} />,
      })}
    >
      <Tab.Screen name="Tasks" component={TasksStackNavigator} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="More" component={MoreStackNavigator} />
    </Tab.Navigator>
  );
}

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{label}</Text>;
}

function Root() {
  const { isLoading, isSignedIn } = useAuth();
  const theme = useAppTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return isSignedIn ? <AppTabs /> : <LoginScreen />;
}

function toNavigationTheme(theme: Theme): typeof DefaultTheme {
  return {
    dark: theme.dark,
    colors: {
      primary: theme.accent,
      background: theme.bg,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: theme.danger,
    },
    fonts: {
      regular: { fontFamily: fonts.body, fontWeight: "400" },
      medium: { fontFamily: fonts.bodyMedium, fontWeight: "500" },
      bold: { fontFamily: fonts.display, fontWeight: "700" },
      heavy: { fontFamily: fonts.display, fontWeight: "700" },
    },
  };
}

function AppRoot() {
  const theme = useAppTheme();

  useEffect(() => {
    network.init();
    const unsubscribeNetwork = network.subscribe((online) => {
      if (online) syncEngine.kick();
    });
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncEngine.kick();
    });
    syncEngine.kick();
    return () => {
      unsubscribeNetwork();
      appStateSub.remove();
    };
  }, []);

  return (
    <NavigationContainer theme={toNavigationTheme(theme)} linking={linking}>
      <Root />
      <StatusBar style={theme.dark ? "light" : "dark"} />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#131110" }}>
        <ActivityIndicator color="#F0A03C" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AuthProvider>
            <AppRoot />
          </AuthProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
