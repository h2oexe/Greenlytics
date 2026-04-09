# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files first to preserve restore-layer caching.
COPY ["Greenlytics.sln", "./"]
COPY ["src/Greenlytics.API/Greenlytics.API.csproj", "src/Greenlytics.API/"]
COPY ["src/Greenlytics.Infrastructure/Greenlytics.Infrastructure.csproj", "src/Greenlytics.Infrastructure/"]
COPY ["src/Greenlytics.Application/Greenlytics.Application.csproj", "src/Greenlytics.Application/"]
COPY ["src/Greenlytics.Domain/Greenlytics.Domain.csproj", "src/Greenlytics.Domain/"]

# Restore dependencies for the API and its referenced projects.
RUN dotnet restore "src/Greenlytics.API/Greenlytics.API.csproj"

# Copy the remaining source after restore.
COPY . .
WORKDIR /src/src/Greenlytics.API

# Publish the API.
RUN dotnet publish "Greenlytics.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "Greenlytics.API.dll"]
