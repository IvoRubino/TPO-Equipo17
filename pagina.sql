-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: pagina
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `pagina`
--

-- CREATE DATABASE /*!32312 IF NOT EXISTS*/ `pagina` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

-- USE `pagina`;

--
-- Table structure for table `archivos_contratacion`
--

DROP TABLE IF EXISTS `archivos_contratacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `archivos_contratacion` (
  `archivo_id` int NOT NULL AUTO_INCREMENT,
  `contratacion_id` int NOT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `ruta` varchar(500) DEFAULT NULL,
  `fecha_subida` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`archivo_id`),
  KEY `contratacion_id` (`contratacion_id`),
  CONSTRAINT `archivos_contratacion_ibfk_1` FOREIGN KEY (`contratacion_id`) REFERENCES `contrataciones` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archivos_contratacion`
--

LOCK TABLES `archivos_contratacion` WRITE;
/*!40000 ALTER TABLE `archivos_contratacion` DISABLE KEYS */;
/*!40000 ALTER TABLE `archivos_contratacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (1,'Running'),(2,'Gimnasio'),(3,'Nutricion'),(4,'Yoga');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comentarios`
--

DROP TABLE IF EXISTS `comentarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comentarios` (
  `cliente_id` int NOT NULL,
  `contratacion_id` int NOT NULL,
  `comentario` text NOT NULL,
  `calificacion` tinyint unsigned NOT NULL,
  `respuesta` text,
  `fecha_comentario` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta` datetime DEFAULT NULL,
  PRIMARY KEY (`cliente_id`,`contratacion_id`),
  KEY `contratacion_id` (`contratacion_id`),
  CONSTRAINT `comentarios_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `comentarios_ibfk_2` FOREIGN KEY (`contratacion_id`) REFERENCES `contrataciones` (`id`),
  CONSTRAINT `comentarios_chk_1` CHECK ((`calificacion` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comentarios`
--

LOCK TABLES `comentarios` WRITE;
/*!40000 ALTER TABLE `comentarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `comentarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `contrataciones`
--

DROP TABLE IF EXISTS `contrataciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `contrataciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cliente_id` int NOT NULL,
  `servicio_id` int NOT NULL,
  `estado` enum('aceptado','rechazado','pendiente','completado') DEFAULT 'pendiente',
  `fecha_solicitud` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_inicio` date DEFAULT NULL,
  `dia_semana` enum('lunes','martes','miercoles','jueves','viernes','sabado','domingo') DEFAULT NULL,
  `hora_inicio` time DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `servicio_id` (`servicio_id`),
  CONSTRAINT `contrataciones_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `contrataciones_ibfk_2` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contrataciones`
--

LOCK TABLES `contrataciones` WRITE;
/*!40000 ALTER TABLE `contrataciones` DISABLE KEYS */;
INSERT INTO `contrataciones` VALUES (2,4,3,'aceptado','2025-05-23 03:08:32',NULL,NULL,NULL);
/*!40000 ALTER TABLE `contrataciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dias_servicio`
--

DROP TABLE IF EXISTS `dias_servicio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dias_servicio` (
  `servicio_id` int NOT NULL,
  `dia` enum('lunes','martes','miercoles','jueves','viernes','sabado','domingo') NOT NULL,
  PRIMARY KEY (`servicio_id`,`dia`),
  CONSTRAINT `dias_servicio_ibfk_1` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dias_servicio`
--

LOCK TABLES `dias_servicio` WRITE;
/*!40000 ALTER TABLE `dias_servicio` DISABLE KEYS */;
/*!40000 ALTER TABLE `dias_servicio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `imagenes_servicio`
--

DROP TABLE IF EXISTS `imagenes_servicio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `imagenes_servicio` (
  `imagen_id` int NOT NULL AUTO_INCREMENT,
  `servicio_id` int DEFAULT NULL,
  `nombre` varchar(255) DEFAULT NULL,
  `ruta` varchar(500) DEFAULT NULL,
  `fecha_subida` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`imagen_id`),
  KEY `imagenes_servicio_ibfk_1` (`servicio_id`),
  CONSTRAINT `imagenes_servicio_ibfk_1` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `imagenes_servicio`
--

LOCK TABLES `imagenes_servicio` WRITE;
/*!40000 ALTER TABLE `imagenes_servicio` DISABLE KEYS */;
/*!40000 ALTER TABLE `imagenes_servicio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `correo` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expiracion` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `servicios`
--

DROP TABLE IF EXISTS `servicios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `servicios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entrenador_id` int NOT NULL,
  `descripcion` text NOT NULL,
  `duracion_minutos` int NOT NULL,
  `modalidad` enum('virtual','presencial') DEFAULT NULL,
  `direccion` varchar(100) NOT NULL,
  `precio` decimal(10,2) NOT NULL,
  `horario_inicio` time NOT NULL,
  `horario_fin` time NOT NULL,
  `estado` enum('publicado','no_publicado','despublicado') DEFAULT 'no_publicado',
  `categoria_id` int DEFAULT NULL,
  `zona_id` int DEFAULT NULL,
  `cantidad_sesiones` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `entrenador_id` (`entrenador_id`),
  KEY `categoria_id` (`categoria_id`),
  KEY `zona_id` (`zona_id`),
  CONSTRAINT `servicios_ibfk_1` FOREIGN KEY (`entrenador_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `servicios_ibfk_2` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`),
  CONSTRAINT `servicios_ibfk_3` FOREIGN KEY (`zona_id`) REFERENCES `zonas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `servicios`
--

LOCK TABLES `servicios` WRITE;
/*!40000 ALTER TABLE `servicios` DISABLE KEYS */;
/*!40000 ALTER TABLE `servicios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `tipo` enum('cliente','entrenador') NOT NULL,
  `descripcion` text,
  `foto_perfil` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `visualizaciones`
--

DROP TABLE IF EXISTS `visualizaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visualizaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `servicio_id` int NOT NULL,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `servicio_id` (`servicio_id`),
  CONSTRAINT `visualizaciones_ibfk_1` FOREIGN KEY (`servicio_id`) REFERENCES `servicios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `visualizaciones`
--

LOCK TABLES `visualizaciones` WRITE;
/*!40000 ALTER TABLE `visualizaciones` DISABLE KEYS */;
/*!40000 ALTER TABLE `visualizaciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `zonas`
--

DROP TABLE IF EXISTS `zonas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `zonas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `zonas`
--

LOCK TABLES `zonas` WRITE;
/*!40000 ALTER TABLE `zonas` DISABLE KEYS */;
INSERT INTO `zonas` VALUES (1,'Recoleta'),(2,'Palermo'),(3,'virtual');
/*!40000 ALTER TABLE `zonas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-06-05 23:11:07
