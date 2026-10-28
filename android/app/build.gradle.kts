import java.util.Properties
plugins { id("com.android.application") }
val signingPropertiesFile = file(System.getenv("COUPLE_ROOM_SIGNING_PROPERTIES") ?: "${System.getProperty("user.home")}/.local/share/couple-room/android-signing/release.properties")
val signingProperties = Properties().apply { if (signingPropertiesFile.exists()) signingPropertiesFile.inputStream().use { load(it) } }
android {
    namespace = "cn.coupleroom.app"
    compileSdk = 36
    defaultConfig { applicationId = "cn.coupleroom.app"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "1.0.0" }
    signingConfigs {
        if (signingPropertiesFile.exists()) create("localRelease") {
            storeFile = file(signingProperties.getProperty("storeFile"))
            storePassword = signingProperties.getProperty("storePassword")
            keyAlias = signingProperties.getProperty("keyAlias")
            keyPassword = signingProperties.getProperty("keyPassword")
        }
    }
    buildTypes {
        release { isMinifyEnabled = false; if (signingPropertiesFile.exists()) signingConfig = signingConfigs.getByName("localRelease") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
dependencies { implementation("androidx.webkit:webkit:1.14.0") }

val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.layout.projectDirectory.dir("../web"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }
