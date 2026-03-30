using Greenlytics.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Minio;
using Minio.DataModel.Args;

namespace Greenlytics.Infrastructure.Services;

public class MinioStorageService : IStorageService
{
    private readonly IMinioClient _minio;
    private readonly string _defaultBucket;

    public MinioStorageService(IConfiguration config)
    {
        var endpoint = config["Minio:Endpoint"] ?? "localhost:9000";
        var accessKey = config["Minio:AccessKey"] ?? "minioadmin";
        var secretKey = config["Minio:SecretKey"] ?? "minioadmin";
        var useSSL = bool.TryParse(config["Minio:UseSsl"], out var s) && s;
        _defaultBucket = config["Minio:BucketName"] ?? "greenlytics-exports";

        _minio = new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .WithSSL(useSSL)
            .Build();
    }

    public async Task<string> UploadFileAsync(string bucketName, string objectKey, Stream content, string contentType, CancellationToken ct = default)
    {
        var exists = await _minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucketName), ct);
        if (!exists)
            await _minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucketName), ct);

        await _minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey)
            .WithStreamData(content)
            .WithObjectSize(content.Length)
            .WithContentType(contentType), ct);

        return objectKey;
    }

    public async Task<string> GetSignedUrlAsync(string bucketName, string objectKey, int expiryMinutes = 60, CancellationToken ct = default)
    {
        return await _minio.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectKey)
            .WithExpiry(expiryMinutes * 60));
    }

    public Task DeleteFileAsync(string bucketName, string objectKey, CancellationToken ct = default) =>
        _minio.RemoveObjectAsync(new RemoveObjectArgs().WithBucket(bucketName).WithObject(objectKey), ct);
}
