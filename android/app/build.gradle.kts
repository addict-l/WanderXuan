import java.util.Properties
import java.net.URI
import groovy.json.JsonOutput
plugins { id("com.android.application") }
val roomTestServer = providers.gradleProperty("roomTestServer").orNull?.let { raw ->
    val uri = try { URI(raw) } catch (_: Exception) {
        throw GradleException("roomTestServer must be an HTTPS URL without credentials, query or fragment")
    }
    if (!uri.scheme.equals("https", ignoreCase = true) || uri.host.isNullOrBlank()
        || uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null
        || uri.port !in -1..65535 || uri.port == 0) {
        throw GradleException("roomTestServer must be an HTTPS URL without credentials, query or fragment")
    }
    uri.toASCIIString().trimEnd('/')
}
val signingPropertiesFile = file(System.getenv("COUPLE_ROOM_SIGNING_PROPERTIES") ?: "${System.getProperty("user.home")}/.local/share/couple-room/android-signing/release.properties")
val signingProperties = Properties().apply { if (signingPropertiesFile.exists()) signingPropertiesFile.inputStream().use { load(it) } }
android {
    namespace = "cn.coupleroom.app"
    compileSdk = 36
    defaultConfig {
        applicationId = if (roomTestServer == null) "cn.coupleroom.app" else "cn.coupleroom.app.preview"
        minSdk = 26; targetSdk = 36; versionCode = 6; versionName = "1.1.3"
        manifestPlaceholders["appLabel"] = if (roomTestServer == null) "@string/app_name" else "双人小屋验收版"
    }
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
dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.core:core:1.17.0")
}

val syncWebAssets by tasks.registering(Sync::class) {
    inputs.property("roomTestServer", roomTestServer ?: "")
    from(rootProject.layout.projectDirectory.dir("../web"))
    exclude("characters-preview.html", "fp-ui-preview.html")
    into(layout.projectDirectory.dir("src/main/assets/www"))
    doLast {
        val sourceConfig = rootProject.layout.projectDirectory.file("../web/config.js").asFile
        val generatedConfig = destinationDir.resolve("config.js")
        if (roomTestServer == null) {
            // A candidate build must never leave its server in a later production build.
            generatedConfig.writeBytes(sourceConfig.readBytes())
        } else {
            val pattern = Regex("(?m)^(\\s*server\\s*:\\s*)(?:'[^']*'|\"[^\"]*\")(\\s*,?\\s*)$")
            val source = sourceConfig.readText()
            check(pattern.findAll(source).count() == 1) { "Expected one server setting in web/config.js" }
            generatedConfig.writeText(pattern.replace(source) { match ->
                match.groupValues[1] + JsonOutput.toJson(roomTestServer) + match.groupValues[2]
            })
        }
    }
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }
