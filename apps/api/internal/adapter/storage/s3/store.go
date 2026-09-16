package s3store

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	appconfig "image-storage/apps/api/internal/config"
	"image-storage/apps/api/internal/port"
)

type Store struct {
	client *s3.Client
	bucket string
}

func New(cfg appconfig.S3Config) (*Store, error) {
	if cfg.Bucket == "" {
		return nil, fmt.Errorf("S3_BUCKET is required")
	}
	if cfg.AccessKey == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("S3_ACCESS_KEY and S3_SECRET_KEY are required")
	}
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKey, cfg.SecretKey, "",
		)),
	)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
		o.UsePathStyle = cfg.UsePathStyle
	})
	store := &Store{client: client, bucket: cfg.Bucket}
	if err := store.ensureBucket(context.Background(), cfg.SkipBucketCreate); err != nil {
		return nil, fmt.Errorf("bucket %q: %w", cfg.Bucket, err)
	}
	return store, nil
}

func (s *Store) ensureBucket(ctx context.Context, skipCreate bool) error {
	if !skipCreate {
		_, err := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(s.bucket),
		})
		if err == nil {
			return nil
		}
	}
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(s.bucket)})
	return err
}

func (s *Store) Save(key string, r io.Reader) error {
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   r,
	})
	return err
}

func (s *Store) Open(key string) (port.BlobObject, error) {
	ctx := context.Background()
	head, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return port.BlobObject{}, err
	}
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return port.BlobObject{}, err
	}
	size := int64(0)
	if head.ContentLength != nil {
		size = *head.ContentLength
	}
	return port.BlobObject{Body: out.Body, Size: size}, nil
}

func (s *Store) Delete(key string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *Store) Key(userID, imageID, filename string) string {
	return fmt.Sprintf("%s/%s/%s", userID, imageID, filename)
}
